import { PermissionFlagsBits } from 'discord.js';
import NodeCache from 'node-cache';
import { AutoMessage, StickyMessage } from '../models/autoMessages.js';
import { LogData } from '../../../shared/utils/logger.js';

const POST_PERMISSIONS = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
/** Never pings anyone: mentions show, but don't notify */
const QUIET = { parse: [] };

/** A sticky is reposted after this much quiet... */
export const STICKY_QUIET_MS = 5000;
/** ...but never later than this after the first message, in a channel that never goes quiet */
export const STICKY_MAX_WAIT_MS = 15_000;

/**
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @returns {import('discord.js').GuildTextBasedChannel | null}
 */
function postable(guild, channelId) {
    const channel = guild.channels.cache.get(channelId);
    const me = guild.members.me;
    if (!channel?.isTextBased() || !me || !channel.permissionsFor(me).has(POST_PERMISSIONS)) return null;
    return channel;
}

// ---------- Auto messages ----------

/**
 * Posts the auto messages that are due on this shard. Each is then due again one interval from now
 * (not from when it was due), so a bot that was offline doesn't post a burst of missed ones.
 * @param {import('discord.js').Client} client
 * @param {Date} [now]
 * @returns {Promise<number>} How many were posted
 */
export async function postDue(client, now = new Date()) {
    const guildIds = [...client.guilds.cache.keys()];
    if (guildIds.length === 0) return 0;
    const due = await AutoMessage.find({ guildId: { $in: guildIds }, enabled: true, nextRunAt: { $lte: now } })
        .limit(100)
        .lean();

    let posted = 0;
    for (const message of due) {
        const next = new Date(now.getTime() + message.intervalMinutes * 60_000);
        // Claimed first, so two checks never post the same one twice
        const claimed = await AutoMessage.updateOne(
            { _id: message._id, nextRunAt: message.nextRunAt },
            { $set: { nextRunAt: next } }
        );
        if (!claimed.modifiedCount) continue;

        const guild = client.guilds.cache.get(message.guildId);
        const channel = guild ? postable(guild, message.channelId) : null;
        if (!channel) continue;
        // Nobody has posted since the last one: skip this round rather than talk to an empty room
        if (message.skipIfQuiet && message.lastMessageId && channel.lastMessageId === message.lastMessageId) continue;

        try {
            const sent = await channel.send({ content: message.content, allowedMentions: QUIET });
            await AutoMessage.updateOne({ _id: message._id }, { $set: { lastMessageId: sent.id } });
            posted++;
        } catch (error) {
            LogData('Auto Messages', `Guild: ${guild.name} | Could not post: ${error.message}`, 'warning');
        }
    }
    return posted;
}

// ---------- Sticky messages ----------

/** Guild ID → (channel ID → sticky), loaded once per server and refreshed when the dashboard saves */
const stickyCache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 5 * 60, useClones: false });

/**
 * A server's stickies, by channel.
 * @param {string} guildId
 * @returns {Promise<Map<string, import('../models/autoMessages.js').StickyMessageType>>}
 */
export async function stickiesFor(guildId) {
    const cached = stickyCache.get(guildId);
    if (cached) return /** @type {Map<string, any>} */ (cached);
    const stickies = await StickyMessage.find({ guildId })
        .lean()
        .catch(() => []);
    const map = new Map(stickies.map((sticky) => /** @type {[string, any]} */ ([sticky.channelId, sticky])));
    stickyCache.set(guildId, map);
    return map;
}

/** Drops a server's stickies from the cache (after the dashboard changes them). */
export function forgetStickies(guildId) {
    stickyCache.del(guildId);
}

/** Channel ID → its pending repost: { timer, firstAt } */
const pending = new Map();

/**
 * Moves a channel's sticky back to the bottom: the old copy is deleted and a new one posted.
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 */
export async function repostSticky(guild, channelId) {
    const sticky = (await stickiesFor(guild.id)).get(channelId);
    const channel = sticky ? postable(guild, channelId) : null;
    if (!sticky || !channel) return;
    // Already at the bottom: nothing to do
    if (sticky.lastMessageId && channel.lastMessageId === sticky.lastMessageId) return;

    if (sticky.lastMessageId) await channel.messages.delete(sticky.lastMessageId).catch(() => {});
    try {
        const sent = await channel.send({ content: sticky.content, allowedMentions: QUIET });
        sticky.lastMessageId = sent.id;
        await StickyMessage.updateOne({ channelId }, { $set: { lastMessageId: sent.id } });
    } catch (error) {
        LogData('Sticky Messages', `Guild: ${guild.name} | Could not repost: ${error.message}`, 'warning');
    }
}

/**
 * Someone posted: the channel's sticky is reposted once it goes quiet for a moment (or at the latest after
 * STICKY_MAX_WAIT_MS), so a busy channel gets one repost, not one per message.
 * @param {import('discord.js').Message} message
 * @param {number} [now]
 */
export async function onMessage(message, now = Date.now()) {
    if (!message.inGuild() || message.author.id === message.client.user?.id) return;
    const stickies = await stickiesFor(message.guildId);
    if (!stickies.has(message.channelId)) return;

    const existing = pending.get(message.channelId);
    const firstAt = existing?.firstAt ?? now;
    if (existing) clearTimeout(existing.timer);
    const wait = Math.max(0, Math.min(STICKY_QUIET_MS, firstAt + STICKY_MAX_WAIT_MS - now));
    const timer = setTimeout(() => {
        pending.delete(message.channelId);
        repostSticky(message.guild, message.channelId).catch(() => {});
    }, wait);
    timer.unref?.();
    pending.set(message.channelId, { timer, firstAt });
}
