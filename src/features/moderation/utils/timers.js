import { ChannelType, EmbedBuilder, RESTJSONErrorCodes } from 'discord.js';
import { TempBan, ChannelLock } from '../models/moderationTimers.js';
import { createCase } from './cases.js';
import { parseDuration } from './checks.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { LogData } from '../../../shared/utils/logger.js';

/** What @everyone can't do in a locked channel: talk, or start threads to talk in. */
export const LOCKED_PERMISSIONS = Object.freeze([
    'SendMessages',
    'SendMessagesInThreads',
    'CreatePublicThreads',
    'CreatePrivateThreads',
]);

/** A temporary ban can be from 1 minute up to a year. */
export const MIN_BAN_MS = 60_000;
export const MAX_BAN_MS = 365 * 24 * 60 * 60_000;
/** A lock can end by itself after 1 minute up to 28 days. */
export const MIN_LOCK_MS = 60_000;
export const MAX_LOCK_MS = 28 * 24 * 60 * 60_000;
/** Discord's longest slowmode: 6 hours. */
export const MAX_SLOWMODE_SECONDS = 6 * 60 * 60;
/** When ending a ban or lock fails (e.g. Ovx lost a permission), it's tried again this much later. */
export const RETRY_MS = 60 * 60_000;

/**
 * Whether a channel can be locked: anywhere people talk, but not categories or threads (lock the channel
 * the thread is in instead).
 * @param {import('discord.js').GuildBasedChannel | null | undefined} channel
 * @returns {boolean}
 */
export function lockableChannel(channel) {
    return Boolean(
        channel &&
        !channel.isThread() &&
        channel.type !== ChannelType.GuildCategory &&
        'permissionOverwrites' in channel
    );
}

/**
 * Stops @everyone talking in a channel, remembering how its permissions were.
 * @param {any} channel - A lockable channel
 * @param {{ moderatorName: string, reason: string | null, until: Date | null, auditReason: string }} details
 * @returns {Promise<'locked' | 'already_locked'>}
 */
export async function lockChannel(channel, { moderatorName, reason, until, auditReason }) {
    const everyone = channel.guild.roles.everyone.id;
    const overwrite = channel.permissionOverwrites.cache.get(everyone);
    const previous = Object.fromEntries(
        LOCKED_PERMISSIONS.map((permission) => [
            permission,
            overwrite?.allow.has(permission) ? 'allow' : overwrite?.deny.has(permission) ? 'deny' : null,
        ])
    );

    // Saved first: the unique channel ID means two moderators can't lock it at once (and lose what it was)
    try {
        await ChannelLock.create({
            guildId: channel.guild.id,
            channelId: channel.id,
            previous,
            hadOverwrite: Boolean(overwrite),
            until,
            moderatorName,
            reason,
        });
    } catch (error) {
        if (error.code === 11000) return 'already_locked';
        throw error;
    }

    try {
        await channel.permissionOverwrites.edit(
            everyone,
            Object.fromEntries(LOCKED_PERMISSIONS.map((permission) => [permission, false])),
            { reason: auditReason }
        );
    } catch (error) {
        await ChannelLock.deleteOne({ channelId: channel.id });
        throw error;
    }
    return 'locked';
}

/**
 * Puts @everyone's permissions back as they were before the lock.
 * @param {any} channel - A lockable channel
 * @param {import('../models/moderationTimers.js').ChannelLockType} lock
 * @param {string} auditReason
 */
export async function unlockChannel(channel, lock, auditReason) {
    const everyone = channel.guild.roles.everyone.id;
    const values = Object.fromEntries(
        LOCKED_PERMISSIONS.map((permission) => {
            const before = lock.previous?.[permission];
            return [permission, before === 'allow' ? true : before === 'deny' ? false : null];
        })
    );
    await channel.permissionOverwrites.edit(everyone, values, { reason: auditReason });

    // The lock made @everyone's overwrite; if nothing is left in it, tidy it away
    const overwrite = channel.permissionOverwrites.cache.get(everyone);
    if (!lock.hadOverwrite && overwrite && overwrite.allow.bitfield === 0n && overwrite.deny.bitfield === 0n) {
        await channel.permissionOverwrites.delete(everyone, auditReason).catch(() => {});
    }
    await ChannelLock.deleteOne({ channelId: channel.id });
}

/**
 * Posts "🔒 This channel is locked" (or unlocked) in the channel itself. Never throws.
 * @param {any} channel
 * @param {string} text
 * @returns {Promise<import('discord.js').Message | null>} The notice, or null if Ovx can't post there
 */
export async function postLockNotice(channel, text) {
    try {
        const embed = new EmbedBuilder().setColor(await brandColour(channel.guild.id)).setDescription(text);
        return await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch {
        return null;
    }
}

/**
 * Reads a slowmode length: "off" or 0 turns it off, a plain number is seconds, otherwise like "30s" or "2m".
 * @param {string} text
 * @returns {number | null} Whole seconds, or null if it isn't a length of time
 */
export function parseSlowmode(text) {
    const input = text.trim().toLowerCase();
    if (input === 'off' || input === 'none') return 0;
    if (/^\d+$/.test(input)) return Number(input);
    const ms = parseDuration(input);
    return ms === null ? null : Math.round(ms / 1000);
}

/**
 * Ends this shard's temporary bans that are due: unbans the member and records it as a case by Ovx.
 * @param {import('discord.js').Client} client
 * @param {Date} [now]
 * @returns {Promise<number>} How many were unbanned
 */
export async function endTempBans(client, now = new Date()) {
    const guildIds = [...client.guilds.cache.keys()];
    if (guildIds.length === 0) return 0;
    const due = await TempBan.find({ guildId: { $in: guildIds }, expiresAt: { $lte: now } })
        .limit(50)
        .lean();

    let ended = 0;
    for (const ban of due) {
        // Claimed by moving it on, so a crash or a second check never unbans twice; removed once done
        const claimed = await TempBan.updateOne(
            { _id: ban._id, expiresAt: ban.expiresAt },
            { $set: { expiresAt: new Date(now.getTime() + RETRY_MS) } }
        );
        if (!claimed.modifiedCount) continue;

        const guild = client.guilds.cache.get(ban.guildId);
        const caseNote = ban.caseNumber ? ` (case #${ban.caseNumber})` : '';
        try {
            await guild.bans.remove(ban.userId, `Temporary ban ended${caseNote}`);
        } catch (error) {
            if (error.code !== RESTJSONErrorCodes.UnknownBan) {
                // Tried again in an hour
                LogData(
                    'Moderation',
                    `Guild: ${guild.name} | Could not end a temporary ban: ${error.message}`,
                    'warning'
                );
                continue;
            }
            // Someone already unbanned them: nothing to record
            await TempBan.deleteOne({ _id: ban._id });
            continue;
        }
        await TempBan.deleteOne({ _id: ban._id });
        await createCase({
            guildId: ban.guildId,
            action: 'unban',
            user: { id: ban.userId, username: ban.username },
            moderator: { id: client.user.id, username: client.user.username },
            reason: `Temporary ban ended${caseNote}`,
        }).catch((error) => LogData('Moderation', `Could not save an unban case: ${error.message}`, 'error'));
        ended++;
    }
    return ended;
}

/**
 * Unlocks this shard's channels whose lock has run out.
 * @param {import('discord.js').Client} client
 * @param {{ now?: Date, notice?: (channel: any) => Promise<unknown> }} [options]
 * @returns {Promise<number>} How many were unlocked
 */
export async function endLocks(client, { now = new Date(), notice = () => Promise.resolve() } = {}) {
    const guildIds = [...client.guilds.cache.keys()];
    if (guildIds.length === 0) return 0;
    const due = await ChannelLock.find({ guildId: { $in: guildIds }, until: { $ne: null, $lte: now } })
        .limit(50)
        .lean();

    let ended = 0;
    for (const lock of due) {
        const claimed = await ChannelLock.updateOne(
            { _id: lock._id, until: lock.until },
            { $set: { until: new Date(now.getTime() + RETRY_MS) } }
        );
        if (!claimed.modifiedCount) continue;

        const guild = client.guilds.cache.get(lock.guildId);
        const channel = guild?.channels.cache.get(lock.channelId);
        if (!lockableChannel(channel)) {
            // The channel was deleted
            await ChannelLock.deleteOne({ _id: lock._id });
            continue;
        }
        try {
            await unlockChannel(channel, lock, 'Lock ended');
            await notice(channel);
            ended++;
        } catch (error) {
            LogData('Moderation', `Guild: ${guild.name} | Could not end a channel lock: ${error.message}`, 'warning');
        }
    }
    return ended;
}
