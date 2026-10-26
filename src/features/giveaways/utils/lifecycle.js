import { randomInt } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Giveaway, GiveawayEntry } from '../models/giveaway.js';
import { giveawayMessage } from './message.js';
import { GIVEAWAY_LIMITS } from './validation.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { Translate } from '../../../shared/utils/i18n.js';
import { LogData } from '../../../shared/utils/logger.js';

const POST_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
];
const ACTIVE_STATUSES = ['scheduled', 'running', 'ending'];
const OBJECT_ID = /^[a-f\d]{24}$/i;

/** @param {unknown} id */
export const isGiveawayId = (id) => typeof id === 'string' && OBJECT_ID.test(id);

/**
 * @typedef {import('../models/giveaway.js').GiveawayType} GiveawayType
 * @typedef {{ ok: boolean, giveaway?: GiveawayType, winners?: string[], reason?: string }} LifecycleResult - reason is set when not ok
 */

/**
 * Picks winners, where each entry is one ticket (so a member with 3 entries is 3 times as likely to win).
 * Nobody wins twice. Uses crypto's random numbers, so results can't be predicted.
 * @param {{ userId: string, entries: number }[]} pool
 * @param {number} count
 * @param {(max: number) => number} [random] - A whole number from 0 up to (not including) max
 * @returns {string[]}
 */
export function pickWinners(pool, count, random = (max) => randomInt(max)) {
    const remaining = pool.filter((entry) => entry.entries > 0);
    const winners = [];
    while (winners.length < count && remaining.length > 0) {
        const total = remaining.reduce((sum, entry) => sum + entry.entries, 0);
        let ticket = random(total);
        const index = remaining.findIndex((entry) => (ticket -= entry.entries) < 0);
        winners.push(remaining[index].userId);
        remaining.splice(index, 1);
    }
    return winners;
}

/**
 * Draws winners who are still in the server and still have a required role. Anyone who doesn't is skipped
 * and another entry is drawn.
 * @param {import('discord.js').Guild} guild
 * @param {GiveawayType} giveaway
 * @param {number} count
 * @param {Set<string>} [excluded] - e.g. earlier winners, for a reroll
 */
async function drawWinners(guild, giveaway, count, excluded = new Set()) {
    const entries = await GiveawayEntry.find({ giveawayId: giveaway._id }, { userId: 1, entries: 1 }).lean();
    const pool = entries.filter((entry) => !excluded.has(entry.userId));
    const { roleIds } = giveaway.requirements ?? { roleIds: [] };
    const winners = [];

    while (winners.length < count && pool.length > 0) {
        const [userId] = pickWinners(pool, 1);
        pool.splice(
            pool.findIndex((entry) => entry.userId === userId),
            1
        );
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) continue;
        if (roleIds.length > 0 && !roleIds.some((roleId) => member.roles.cache.has(roleId))) continue;
        winners.push(userId);
    }
    return winners;
}

/**
 * The channel a giveaway posts in, if Ovx can still post there.
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @returns {import('discord.js').GuildTextBasedChannel | null}
 */
export function giveawayChannel(guild, channelId) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased() || !guild.members.me) return null;
    return channel.permissionsFor(guild.members.me).has(POST_PERMISSIONS) ? channel : null;
}

/**
 * Starts (or schedules) a validated giveaway.
 * @param {import('discord.js').Guild} guild
 * @param {NonNullable<ReturnType<typeof import('./validation.js').validateGiveaway>['giveaway']>} valid
 * @param {{ hostId: string, createdBy: string }} people
 * @returns {Promise<LifecycleResult>}
 */
export async function createGiveaway(guild, valid, { hostId, createdBy }) {
    const active = await Giveaway.countDocuments({ guildId: guild.id, status: { $in: ACTIVE_STATUSES } });
    if (active >= GIVEAWAY_LIMITS.ACTIVE_MAX) return { ok: false, reason: 'too_many' };
    if (!giveawayChannel(guild, valid.channelId)) return { ok: false, reason: 'no_channel' };

    const created = (await Giveaway.create({ guildId: guild.id, ...valid, hostId, createdBy })).toObject();
    if (created.status === 'scheduled') return { ok: true, giveaway: created };

    const posted = await postGiveaway(guild, created);
    if (!posted) {
        await Giveaway.deleteOne({ _id: created._id });
        return { ok: false, reason: 'no_channel' };
    }
    return { ok: true, giveaway: posted };
}

/**
 * Posts a giveaway's message and saves its ID.
 * @param {import('discord.js').Guild} guild
 * @param {GiveawayType} giveaway
 * @returns {Promise<GiveawayType | null>} null if it couldn't be posted
 */
async function postGiveaway(guild, giveaway) {
    const channel = giveawayChannel(guild, giveaway.channelId);
    if (!channel) return null;
    try {
        const message = await channel.send(await giveawayMessage(guild, giveaway));
        return await Giveaway.findByIdAndUpdate(
            giveaway._id,
            { $set: { messageId: message.id, status: 'running' } },
            { returnDocument: 'after' }
        ).lean();
    } catch (error) {
        LogData('Giveaways', `Guild: ${guild.name} | Could not post giveaway: ${error.message}`, 'warning');
        return null;
    }
}

/**
 * Posts a scheduled giveaway whose start time has come. Cancelled if its channel is gone.
 * @param {import('discord.js').Guild} guild
 * @param {{ _id: unknown }} giveaway
 */
export async function startScheduledGiveaway(guild, giveaway) {
    // Claimed first, so a giveaway is never posted twice
    const claimed = await Giveaway.findOneAndUpdate(
        { _id: giveaway._id, status: 'scheduled' },
        { $set: { status: 'running' } },
        { returnDocument: 'after' }
    ).lean();
    if (!claimed) return;
    if (!(await postGiveaway(guild, claimed))) {
        await Giveaway.updateOne({ _id: claimed._id }, { $set: { status: 'cancelled', endedAt: new Date() } });
        LogData(
            'Giveaways',
            `Guild: ${guild.name} | Scheduled giveaway cancelled: can't post in its channel`,
            'warning'
        );
    }
}

/**
 * Ends a running giveaway: draws winners, updates the message, announces them and DMs them.
 * @param {import('discord.js').Guild} guild
 * @param {string} giveawayId
 * @param {Date} [now]
 * @returns {Promise<LifecycleResult>}
 */
export async function endGiveaway(guild, giveawayId, now = new Date()) {
    // Claimed first, so ending from the timer and a command at the same moment draws once
    const claimed = await Giveaway.findOneAndUpdate(
        { _id: giveawayId, guildId: guild.id, status: 'running' },
        { $set: { status: 'ending' } },
        { returnDocument: 'after' }
    ).lean();
    if (!claimed) return { ok: false, reason: 'not_running' };

    const winners = await drawWinners(guild, claimed, claimed.winnerCount);
    const ended = await Giveaway.findByIdAndUpdate(
        claimed._id,
        { $set: { status: 'ended', winners, endedAt: now } },
        { returnDocument: 'after' }
    ).lean();

    await refreshMessage(guild, ended);
    await announce(guild, ended, winners, false);
    return { ok: true, giveaway: ended, winners };
}

/**
 * Draws new winners for an ended giveaway, from entrants who haven't won it yet.
 * @param {import('discord.js').Guild} guild
 * @param {string} giveawayId
 * @param {number} [count]
 * @returns {Promise<LifecycleResult>}
 */
export async function rerollGiveaway(guild, giveawayId, count = 1) {
    const giveaway = await Giveaway.findOne({ _id: giveawayId, guildId: guild.id, status: 'ended' }).lean();
    if (!giveaway) return { ok: false, reason: 'not_ended' };

    const winners = await drawWinners(guild, giveaway, count, new Set(giveaway.winners));
    if (winners.length === 0) return { ok: false, reason: 'no_entrants_left' };

    const updated = await Giveaway.findByIdAndUpdate(
        giveaway._id,
        { $push: { winners: { $each: winners } } },
        { returnDocument: 'after' }
    ).lean();
    await refreshMessage(guild, updated);
    await announce(guild, updated, winners, true);
    return { ok: true, giveaway: updated, winners };
}

/**
 * Stops a scheduled or running giveaway without drawing winners.
 * @param {import('discord.js').Guild} guild
 * @param {string} giveawayId
 * @returns {Promise<LifecycleResult>}
 */
export async function cancelGiveaway(guild, giveawayId) {
    const cancelled = await Giveaway.findOneAndUpdate(
        { _id: giveawayId, guildId: guild.id, status: { $in: ['scheduled', 'running'] } },
        { $set: { status: 'cancelled', endedAt: new Date() } },
        { returnDocument: 'after' }
    ).lean();
    if (!cancelled) return { ok: false, reason: 'not_active' };
    await refreshMessage(guild, cancelled);
    return { ok: true, giveaway: cancelled };
}

/**
 * Removes a giveaway that isn't running, with its entries. Its message (if any) is left as it is.
 * @param {string} guildId
 * @param {string} giveawayId
 * @returns {Promise<LifecycleResult>}
 */
export async function deleteGiveaway(guildId, giveawayId) {
    const removed = await Giveaway.findOneAndDelete({
        _id: giveawayId,
        guildId,
        status: { $in: ['scheduled', 'ended', 'cancelled'] },
    }).lean();
    if (!removed) return { ok: false, reason: 'not_deletable' };
    await GiveawayEntry.deleteMany({ giveawayId: removed._id });
    return { ok: true, giveaway: removed };
}

/**
 * Updates the giveaway's message to match it. A deleted message or channel is fine: there's nothing to update.
 * @param {import('discord.js').Guild} guild
 * @param {GiveawayType} giveaway
 */
export async function refreshMessage(guild, giveaway) {
    if (!giveaway.messageId) return;
    const channel = guild.channels.cache.get(giveaway.channelId);
    if (!channel?.isTextBased()) return;
    try {
        const message = await channel.messages.fetch(giveaway.messageId);
        await message.edit(await giveawayMessage(guild, giveaway));
    } catch (error) {
        LogData('Giveaways', `Guild: ${guild.name} | Could not update giveaway message: ${error.message}`, 'debug');
    }
}

/** Giveaway ID → pending timer: entering edits the message's count at most every few seconds */
const pendingRefreshes = new Map();
const REFRESH_DELAY_MS = 5000;

/**
 * Updates the entrant count on the message soon, batching many entries into one edit.
 * @param {import('discord.js').Guild} guild
 * @param {string} giveawayId
 */
export function scheduleRefresh(guild, giveawayId) {
    if (pendingRefreshes.has(giveawayId)) return;
    const timer = setTimeout(async () => {
        pendingRefreshes.delete(giveawayId);
        const giveaway = await Giveaway.findById(giveawayId)
            .lean()
            .catch(() => null);
        if (giveaway?.status === 'running') await refreshMessage(guild, giveaway);
    }, REFRESH_DELAY_MS);
    timer.unref?.();
    pendingRefreshes.set(giveawayId, timer);
}

/**
 * Posts the winners under the giveaway, and DMs each of them.
 * @param {import('discord.js').Guild} guild
 * @param {GiveawayType} giveaway
 * @param {string[]} winners - Just the ones drawn now
 * @param {boolean} reroll
 */
async function announce(guild, giveaway, winners, reroll) {
    const locale = guild.preferredLocale;
    const t = (key, vars) => Translate(`giveaways.announce.${key}`, locale, vars);
    const mentions = winners.map((userId) => `<@${userId}>`).join(', ');
    const prize = giveaway.prize;

    const channel = giveawayChannel(guild, giveaway.channelId);
    if (channel) {
        const content =
            winners.length === 0 ? t('none', { prize }) : t(reroll ? 'reroll' : 'won', { winners: mentions, prize });
        await channel
            .send({
                content,
                ...(giveaway.messageId && { reply: { messageReference: giveaway.messageId, failIfNotExists: false } }),
                allowedMentions: { users: winners, repliedUser: false },
            })
            .catch((error) =>
                LogData('Giveaways', `Guild: ${guild.name} | Could not announce: ${error.message}`, 'warning')
            );
    }

    if (winners.length === 0) return;
    const link = giveaway.messageId
        ? `https://discord.com/channels/${guild.id}/${giveaway.channelId}/${giveaway.messageId}`
        : null;
    const embed = new EmbedBuilder()
        .setColor(await brandColour(guild.id))
        .setTitle(t('dm_title'))
        .setDescription(t('dm_description', { prize, guild: guild.name }));
    const components = link
        ? [
              /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
                  new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(link).setLabel(t('dm_button'))
              ),
          ]
        : [];
    for (const userId of winners) {
        const user = await guild.client.users.fetch(userId).catch(() => null);
        await user?.send({ embeds: [embed], components }).catch(() => {}); // DMs closed: the announcement still pings them
    }
}

/**
 * After a restart: giveaways interrupted while drawing go back to running, so the timer ends them again.
 * @param {string[]} guildIds - This shard's servers
 */
export async function recoverInterrupted(guildIds) {
    if (guildIds.length === 0) return;
    await Giveaway.updateMany({ guildId: { $in: guildIds }, status: 'ending' }, { $set: { status: 'running' } });
}

/**
 * Deletes ended and cancelled giveaways (and their entries) older than GIVEAWAY_LIMITS.KEEP_DAYS.
 * @param {string[]} guildIds - This shard's servers
 * @param {Date} [now]
 */
export async function deleteOldGiveaways(guildIds, now = new Date()) {
    if (guildIds.length === 0) return 0;
    const cutoff = new Date(now.getTime() - GIVEAWAY_LIMITS.KEEP_DAYS * 24 * 60 * 60 * 1000);
    const old = await Giveaway.find(
        { guildId: { $in: guildIds }, status: { $in: ['ended', 'cancelled'] }, endedAt: { $lt: cutoff } },
        { _id: 1 }
    ).lean();
    if (old.length === 0) return 0;
    const ids = old.map((giveaway) => giveaway._id);
    await GiveawayEntry.deleteMany({ giveawayId: { $in: ids } });
    await Giveaway.deleteMany({ _id: { $in: ids } });
    return old.length;
}
