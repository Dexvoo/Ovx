import { Suggestion, SuggestionConfig, SUGGESTION_STATUSES } from '../models/suggestion.js';
import { suggestionConfig, decide, deleteSuggestion } from './actions.js';
import { approval } from './post.js';

export const SUGGESTION_LIMITS = Object.freeze({ COOLDOWN_MAX: 1440, MANAGER_ROLES_MAX: 10, LIST_MAX: 200 });

/**
 * The dashboard's Suggestions page, run on the shard after the Manage Server check (see dashboard/shardHandlers.js).
 * @typedef {{ ok: true, data: any, changes?: string[], action?: string } | { ok: false, status: number, error: string, details?: string[] }} Result
 */

/** @param {import('../models/suggestion.js').SuggestionConfigType} config */
export function suggestionSettingsView(config) {
    return {
        enabled: config.enabled,
        channelId: config.channelId ?? null,
        threads: config.threads,
        dmAuthor: config.dmAuthor,
        cooldownMinutes: config.cooldownMinutes,
        managerRoleIds: [...config.managerRoleIds],
    };
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {any} suggestion
 */
function suggestionView(guild, suggestion) {
    const user = (id) => (id ? { id, name: guild.members.cache.get(id)?.displayName ?? null } : null);
    return {
        id: String(suggestion._id),
        number: suggestion.number,
        content: suggestion.content,
        imageUrl: suggestion.imageUrl ?? null,
        author: user(suggestion.authorId),
        status: suggestion.status,
        reason: suggestion.reason ?? null,
        decidedBy: user(suggestion.decidedBy),
        up: suggestion.upvoters.length,
        down: suggestion.downvoters.length,
        approval: approval(suggestion.upvoters.length, suggestion.downvoters.length),
        createdAt: new Date(suggestion.createdAt).toISOString(),
        messageUrl: suggestion.messageId
            ? `https://discord.com/channels/${suggestion.guildId}/${suggestion.channelId}/${suggestion.messageId}`
            : null,
    };
}

/**
 * @param {unknown} input
 * @param {import('../../../dashboard/validation.js').GuildContext} guild
 */
export function validateSuggestionSettings(input, guild) {
    const errors = [];
    const data = input && typeof input === 'object' ? /** @type {any} */ (input) : {};
    for (const key of ['enabled', 'threads', 'dmAuthor'])
        if (typeof data[key] !== 'boolean') errors.push(`${key} must be on or off`);

    const channelId = data.channelId || null;
    if (channelId && !guild.textChannelIds.has(channelId)) errors.push('Choose a text channel Ovx can post in.');
    if (data.enabled === true && !channelId) errors.push('Choose a suggestions channel before turning it on.');

    const cooldownMinutes = Number(data.cooldownMinutes ?? 0);
    if (!Number.isInteger(cooldownMinutes) || cooldownMinutes < 0 || cooldownMinutes > SUGGESTION_LIMITS.COOLDOWN_MAX) {
        errors.push(`The cooldown must be from 0 to ${SUGGESTION_LIMITS.COOLDOWN_MAX} minutes.`);
    }
    const managerRoleIds = Array.isArray(data.managerRoleIds)
        ? [...new Set(data.managerRoleIds.filter((id) => typeof id === 'string'))]
        : [];
    if (managerRoleIds.length > SUGGESTION_LIMITS.MANAGER_ROLES_MAX)
        errors.push(`Choose at most ${SUGGESTION_LIMITS.MANAGER_ROLES_MAX} roles.`);
    if (managerRoleIds.some((id) => !guild.roles.has(id))) errors.push('One of the roles no longer exists.');

    if (errors.length) return { settings: null, errors };
    return {
        settings: {
            enabled: data.enabled,
            channelId,
            threads: data.threads,
            dmAuthor: data.dmAuthor,
            cooldownMinutes,
            managerRoleIds,
        },
        errors,
    };
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member
 * @param {{ op: string, settings?: unknown, status?: unknown, suggestionId?: unknown, reason?: unknown }} payload
 * @param {import('../../../dashboard/validation.js').GuildContext} context
 * @param {{ channel: (id: string) => string, role: (id: string) => string }} names
 * @returns {Promise<Result>}
 */
export async function suggestionsDashboard(guild, member, payload, context, names) {
    const { op } = payload;

    if (op === 'list') {
        const status = SUGGESTION_STATUSES.includes(/** @type {string} */ (payload.status)) ? payload.status : null;
        const suggestions = await Suggestion.find({ guildId: guild.id, ...(status && { status }) })
            .sort({ number: -1 })
            .limit(SUGGESTION_LIMITS.LIST_MAX)
            .lean();
        return {
            ok: true,
            data: {
                settings: suggestionSettingsView(await suggestionConfig(guild.id)),
                suggestions: suggestions.map((suggestion) => suggestionView(guild, suggestion)),
            },
        };
    }

    if (op === 'settings') {
        const { settings, errors } = validateSuggestionSettings(payload.settings, context);
        if (!settings) return { ok: false, status: 400, error: 'Some settings are not valid', details: errors };
        const before = suggestionSettingsView(await suggestionConfig(guild.id));
        await SuggestionConfig.updateOne({ guildId: guild.id }, { $set: settings }, { upsert: true });
        const after = suggestionSettingsView(await suggestionConfig(guild.id));
        const onOff = (value) => (value ? 'on' : 'off');
        const changes = [
            before.enabled !== after.enabled && `Suggestions: ${onOff(before.enabled)} → ${onOff(after.enabled)}`,
            before.channelId !== after.channelId &&
                `Channel: ${names.channel(before.channelId)} → ${names.channel(after.channelId)}`,
            before.threads !== after.threads &&
                `Discussion threads: ${onOff(before.threads)} → ${onOff(after.threads)}`,
            before.dmAuthor !== after.dmAuthor && `DM the author: ${onOff(before.dmAuthor)} → ${onOff(after.dmAuthor)}`,
            before.cooldownMinutes !== after.cooldownMinutes &&
                `Cooldown: ${before.cooldownMinutes} → ${after.cooldownMinutes} minutes`,
            ...after.managerRoleIds
                .filter((id) => !before.managerRoleIds.includes(id))
                .map((id) => `Added manager role: ${names.role(id)}`),
            ...before.managerRoleIds
                .filter((id) => !after.managerRoleIds.includes(id))
                .map((id) => `Removed manager role: ${names.role(id)}`),
        ].filter(Boolean);
        return { ok: true, data: after, changes, action: 'Updated suggestion settings' };
    }

    if (op === 'decide') {
        const result = await decide(guild, String(payload.suggestionId), String(payload.status), {
            reason: typeof payload.reason === 'string' ? payload.reason : null,
            decidedBy: member.id,
        });
        if (!result.ok)
            return {
                ok: false,
                status: result.error === 'not_found' ? 404 : 400,
                error: result.error === 'not_found' ? 'That suggestion no longer exists' : 'Choose a status',
            };
        return {
            ok: true,
            data: suggestionView(guild, result.suggestion),
            changes: [
                `#${result.suggestion.number}: ${result.suggestion.status}${result.suggestion.reason ? ` (${result.suggestion.reason})` : ''}`,
            ],
            action: 'Decided a suggestion',
        };
    }

    if (op === 'delete') {
        const removed = await deleteSuggestion(guild, String(payload.suggestionId));
        if (!removed) return { ok: false, status: 404, error: 'That suggestion no longer exists' };
        return {
            ok: true,
            data: { removed: String(removed._id) },
            changes: [`#${removed.number}: ${removed.content.slice(0, 100)}`],
            action: 'Deleted a suggestion',
        };
    }

    return { ok: false, status: 400, error: 'Unknown suggestions action' };
}
