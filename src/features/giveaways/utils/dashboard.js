import { Giveaway, GiveawayConfig } from '../models/giveaway.js';
import { validateGiveaway, validateGiveawaySettings, GIVEAWAY_LIMITS } from './validation.js';
import {
    createGiveaway,
    endGiveaway,
    rerollGiveaway,
    cancelGiveaway,
    deleteGiveaway,
    isGiveawayId,
} from './lifecycle.js';
import { formatDuration } from '../../moderation/utils/checks.js';
import { Translate } from '../../../shared/utils/i18n.js';

/**
 * The dashboard's Giveaways page, run on the shard after the Manage Server check (see dashboard/shardHandlers.js).
 * Results are the shard handler shape, plus `action`: the Web Logs entry's title when something changed.
 *
 * @typedef {{ ok: true, data: any, changes?: string[], action?: string } | { ok: false, status: number, error: string, details?: string[] }} Result
 */

/** Lifecycle failure → HTTP status. The message is the same one /giveaway shows. */
const FAILURE_STATUS = {
    too_many: 400,
    no_channel: 400,
    not_running: 409,
    not_ended: 409,
    not_active: 409,
    not_deletable: 409,
    no_entrants_left: 409,
};

/** @param {string} reason */
const failure = (reason) => ({
    ok: /** @type {false} */ (false),
    status: FAILURE_STATUS[reason] ?? 400,
    error: Translate(`giveaways.command.${reason}`, 'en-GB', { max: GIVEAWAY_LIMITS.ACTIVE_MAX }),
});

/**
 * A date as ISO text, or null if it's missing or not a real date (so one odd record can't break the list).
 * @param {unknown} value
 */
function isoDate(value) {
    if (!value) return null;
    const date = new Date(/** @type {any} */ (value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * A giveaway as the dashboard shows it.
 * @param {import('discord.js').Guild} guild
 * @param {import('../models/giveaway.js').GiveawayType} giveaway
 */
export function giveawayView(guild, giveaway) {
    const userName = (userId) => {
        const user = guild.client.users.cache.get(userId);
        return { id: userId, name: user ? user.username : null };
    };
    return {
        id: String(giveaway._id),
        prize: giveaway.prize,
        description: giveaway.description ?? null,
        channelId: giveaway.channelId,
        winnerCount: giveaway.winnerCount,
        host: userName(giveaway.hostId),
        startsAt: isoDate(giveaway.startsAt ?? giveaway.createdAt),
        endsAt: isoDate(giveaway.endsAt),
        endedAt: isoDate(giveaway.endedAt),
        // 'ending' only lasts while winners are drawn; one without a status is an old giveaway not converted yet
        status: giveaway.status === 'ending' ? 'running' : (giveaway.status ?? 'ended'),
        requirements: {
            roleIds: giveaway.requirements?.roleIds ?? [],
            minLevel: giveaway.requirements?.minLevel ?? 0,
        },
        voteBonus: giveaway.voteBonus ?? 0,
        winners: (giveaway.winners ?? []).map(userName),
        entrantCount: giveaway.entrantCount ?? 0,
        messageUrl: giveaway.messageId
            ? `https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`
            : null,
    };
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 */
const channelName = (guild, channelId) => `#${guild.channels.cache.get(channelId)?.name ?? 'deleted-channel'}`;

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member - Who is doing it (checked for Manage Server already)
 * @param {{ op: string, giveawayId?: unknown, giveaway?: unknown, settings?: unknown, count?: unknown }} payload
 * @param {{ textChannelIds: Set<string>, roleIds: Set<string> }} context
 * @returns {Promise<Result>}
 */
export async function giveawayDashboard(guild, member, payload, context) {
    const { op } = payload;

    if (op === 'list') {
        const giveaways = await Giveaway.find({ guildId: guild.id }).sort({ createdAt: -1 }).limit(100).lean();
        const config = await GiveawayConfig.findOne({ guildId: guild.id }).lean();
        return {
            ok: true,
            data: {
                giveaways: giveaways.map((giveaway) => giveawayView(guild, giveaway)),
                settings: { managerRoleIds: config?.managerRoleIds ?? [] },
            },
        };
    }

    if (op === 'settings') {
        const { settings, errors } = validateGiveawaySettings(payload.settings, context);
        if (!settings) return { ok: false, status: 400, error: 'Some settings are not valid', details: errors };
        const before = (await GiveawayConfig.findOne({ guildId: guild.id }).lean())?.managerRoleIds ?? [];
        await GiveawayConfig.updateOne({ guildId: guild.id }, { $set: settings }, { upsert: true });

        const roleName = (id) => `@${guild.roles.cache.get(id)?.name ?? 'deleted-role'}`;
        const added = settings.managerRoleIds.filter((id) => !before.includes(id)).map(roleName);
        const removed = before.filter((id) => !settings.managerRoleIds.includes(id)).map(roleName);
        const changes = [
            ...(added.length ? [`Giveaway manager roles added: ${added.join(', ')}`] : []),
            ...(removed.length ? [`Giveaway manager roles removed: ${removed.join(', ')}`] : []),
        ];
        return { ok: true, data: settings, changes, action: 'Updated giveaway settings' };
    }

    if (op === 'create') {
        const { giveaway: valid, errors } = validateGiveaway(/** @type {any} */ (payload.giveaway), context);
        if (!valid) return { ok: false, status: 400, error: 'Some details are not valid', details: errors };

        const result = await createGiveaway(guild, valid, { hostId: member.id, createdBy: member.id });
        if (!result.ok) return failure(result.reason);

        const scheduled = valid.status === 'scheduled';
        const duration = formatDuration(valid.endsAt.getTime() - valid.startsAt.getTime());
        const details = [
            `${valid.winnerCount} winner${valid.winnerCount === 1 ? '' : 's'}`,
            `runs ${duration}`,
            ...(scheduled ? [`starts ${valid.startsAt.toUTCString()}`] : []),
        ];
        return {
            ok: true,
            data: giveawayView(guild, result.giveaway),
            changes: [`"${valid.prize}" in ${channelName(guild, valid.channelId)}: ${details.join(', ')}`],
            action: scheduled ? 'Scheduled a giveaway' : 'Started a giveaway',
        };
    }

    if (!isGiveawayId(payload.giveawayId)) return { ok: false, status: 404, error: 'That giveaway no longer exists' };
    const giveawayId = /** @type {string} */ (payload.giveawayId);

    if (op === 'end' || op === 'reroll' || op === 'cancel') {
        let result;
        if (op === 'end') result = await endGiveaway(guild, giveawayId);
        else if (op === 'cancel') result = await cancelGiveaway(guild, giveawayId);
        else {
            const count = Number(payload.count ?? 1);
            if (!Number.isInteger(count) || count < 1 || count > GIVEAWAY_LIMITS.WINNERS_MAX) {
                return { ok: false, status: 400, error: `Choose between 1 and ${GIVEAWAY_LIMITS.WINNERS_MAX} winners` };
            }
            result = await rerollGiveaway(guild, giveawayId, count);
        }
        if (!result.ok) return failure(result.reason);

        const names = (result.winners ?? []).map((id) => `@${guild.client.users.cache.get(id)?.username ?? id}`);
        const summary = {
            end: `"${result.giveaway.prize}": ${names.length ? `won by ${names.join(', ')}` : 'no winners'}`,
            reroll: `"${result.giveaway.prize}": new winner${names.length === 1 ? '' : 's'} ${names.join(', ')}`,
            cancel: `"${result.giveaway.prize}"`,
        }[op];
        return {
            ok: true,
            data: giveawayView(guild, result.giveaway),
            changes: [summary],
            action: { end: 'Ended a giveaway', reroll: 'Rerolled a giveaway', cancel: 'Cancelled a giveaway' }[op],
        };
    }

    if (op === 'delete') {
        const result = await deleteGiveaway(guild.id, giveawayId);
        if (!result.ok) return failure(result.reason);
        return {
            ok: true,
            data: { removed: giveawayId },
            changes: [`"${result.giveaway.prize}"`],
            action: 'Deleted a giveaway',
        };
    }

    return { ok: false, status: 400, error: 'Unknown giveaway action' };
}
