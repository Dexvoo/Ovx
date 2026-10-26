import { ServerStats, COUNTER_TYPES, DEFAULT_TEMPLATES } from '../models/serverStats.js';
import { countFor, counterName, createCounterChannel, COUNTERS_MAX } from './counters.js';
import { LogData } from '../../../shared/utils/logger.js';

export const SERVER_STATS_LIMITS = Object.freeze({ COUNTERS_MAX, TEMPLATE_MAX: 90 });
const TYPE_NAMES = {
    members: 'Members',
    humans: 'People',
    bots: 'Bots',
    boosts: 'Boosts',
    channels: 'Channels',
    roles: 'Roles',
    role: 'Members with a role',
};

/**
 * The dashboard's Server Stats page, run on the shard after the Manage Server check (see dashboard/shardHandlers.js).
 * @typedef {{ ok: true, data: any, changes?: string[], action?: string } | { ok: false, status: number, error: string, details?: string[] }} Result
 */

/**
 * @param {import('discord.js').Guild} guild
 * @param {any} config - Saved settings (lean), or null
 */
export function serverStatsView(guild, config) {
    return {
        counters: (config?.counters ?? []).map((counter) => {
            const channel = guild.channels.cache.get(counter.channelId);
            return {
                type: counter.type,
                roleId: counter.roleId ?? null,
                channelId: counter.channelId,
                template: counter.template,
                exists: Boolean(channel),
                name: channel?.name ?? null,
                preview: counterName(guild, counter, countFor(guild, counter)),
            };
        }),
    };
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member
 * @param {{ op: string, type?: unknown, roleId?: unknown, channelId?: unknown, template?: unknown }} payload
 * @returns {Promise<Result>}
 */
export async function serverStatsDashboard(guild, member, payload) {
    const config = await ServerStats.findOne({ guildId: guild.id }).lean();
    const counters = config?.counters ?? [];
    const reason = `Server stats changed on the Ovx dashboard by @${member.user.username}`;
    const roleName = (id) => `@${guild.roles.cache.get(id)?.name ?? 'deleted-role'}`;

    if (payload.op === 'add') {
        const type = /** @type {string} */ (payload.type);
        if (!COUNTER_TYPES.includes(type)) return { ok: false, status: 400, error: 'Choose what to count.' };
        if (counters.length >= COUNTERS_MAX)
            return { ok: false, status: 400, error: `A server can have at most ${COUNTERS_MAX} counters.` };
        const roleId = type === 'role' ? payload.roleId : null;
        if (type === 'role' && (typeof roleId !== 'string' || !guild.roles.cache.has(roleId))) {
            return { ok: false, status: 400, error: 'Choose a role to count.' };
        }
        const counter = {
            type,
            roleId: /** @type {string | null} */ (roleId),
            channelId: '',
            template: DEFAULT_TEMPLATES[type],
        };
        let created;
        try {
            created = await createCounterChannel(guild, counter, config?.categoryId ?? null, reason);
        } catch (error) {
            return {
                ok: false,
                status: 400,
                error: `Ovx couldn't make the channel: ${error.message}. It needs Manage Channels.`,
            };
        }
        const saved = await ServerStats.findOneAndUpdate(
            { guildId: guild.id },
            {
                $set: { categoryId: created.categoryId },
                $push: { counters: { ...counter, channelId: created.channelId } },
            },
            { upsert: true, returnDocument: 'after' }
        ).lean();
        return {
            ok: true,
            data: serverStatsView(guild, saved),
            changes: [`Added a counter: ${TYPE_NAMES[type]}${roleId ? ` (${roleName(roleId)})` : ''}`],
            action: 'Updated server stats',
        };
    }

    const index = counters.findIndex((counter) => counter.channelId === payload.channelId);
    if (index === -1) return { ok: false, status: 404, error: 'That counter no longer exists.' };
    const counter = counters[index];

    if (payload.op === 'rename') {
        const template = typeof payload.template === 'string' ? payload.template.trim() : '';
        if (!template) return { ok: false, status: 400, error: 'Enter a name.' };
        if (template.length > SERVER_STATS_LIMITS.TEMPLATE_MAX) {
            return {
                ok: false,
                status: 400,
                error: `The name can be at most ${SERVER_STATS_LIMITS.TEMPLATE_MAX} characters.`,
            };
        }
        if (!template.includes('{count}'))
            return { ok: false, status: 400, error: 'Include {count} where the number goes.' };
        const saved = await ServerStats.findOneAndUpdate(
            { guildId: guild.id, 'counters.channelId': counter.channelId },
            { $set: { 'counters.$.template': template } },
            { returnDocument: 'after' }
        ).lean();
        // Renamed in the background: if Discord's rename limit was hit, it waits and still happens
        const channel = guild.channels.cache.get(counter.channelId);
        channel
            ?.setName(counterName(guild, { ...counter, template }, countFor(guild, counter)), reason)
            .catch((error) =>
                LogData('Server Stats', `Guild: ${guild.name} | Rename failed: ${error.message}`, 'warning')
            );
        return {
            ok: true,
            data: serverStatsView(guild, saved),
            changes: [`Counter renamed to "${template}"`],
            action: 'Updated server stats',
        };
    }

    if (payload.op === 'remove') {
        const saved = await ServerStats.findOneAndUpdate(
            { guildId: guild.id },
            { $pull: { counters: { channelId: counter.channelId } } },
            { returnDocument: 'after' }
        ).lean();
        await guild.channels.cache
            .get(counter.channelId)
            ?.delete(reason)
            .catch(() => {});
        return {
            ok: true,
            data: serverStatsView(guild, saved),
            changes: [`Removed a counter: ${TYPE_NAMES[counter.type]}`],
            action: 'Updated server stats',
        };
    }

    return { ok: false, status: 400, error: 'Unknown server stats action' };
}
