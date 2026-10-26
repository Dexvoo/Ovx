import { ChannelType, OverwriteType, PermissionFlagsBits } from 'discord.js';
import Temp_Voice_Config_Cache from '../cache/tempVoiceConfig.cache.js';

export const TEMP_VOICE_LIMITS = Object.freeze({ HUBS_MAX: 5, NAME_MAX: 100, USER_LIMIT_MAX: 99 });
const DEFAULT_TEMPLATE = "{user}'s channel";

/**
 * The dashboard's Temp Voice page, run on the shard after the Manage Server check (see dashboard/shardHandlers.js).
 * @typedef {{ ok: true, data: any, changes?: string[], action?: string } | { ok: false, status: number, error: string, details?: string[] }} Result
 */

/** @param {import('../models/tempVoice.js').TempVoiceConfigType} config */
export function tempVoiceView(config) {
    return {
        enabled: config.enabled,
        hubs: config.hubs.map(({ channelId, categoryId, nameTemplate, userLimit }) => ({
            channelId,
            categoryId: categoryId ?? null,
            nameTemplate,
            userLimit,
        })),
    };
}

/**
 * @param {unknown} input
 * @param {{ voiceChannelIds: Set<string>, categoryIds: Set<string> }} guild
 */
export function validateTempVoiceSettings(input, guild) {
    const errors = [];
    const data = input && typeof input === 'object' ? /** @type {any} */ (input) : {};
    if (typeof data.enabled !== 'boolean') errors.push('enabled must be on or off');

    const raw = Array.isArray(data.hubs) ? data.hubs : [];
    if (raw.length > TEMP_VOICE_LIMITS.HUBS_MAX)
        errors.push(`At most ${TEMP_VOICE_LIMITS.HUBS_MAX} join-to-create channels.`);
    const seen = new Set();
    const hubs = raw.slice(0, TEMP_VOICE_LIMITS.HUBS_MAX).map((hub, index) => {
        const item = hub && typeof hub === 'object' ? hub : {};
        const label = `Channel ${index + 1}`;
        if (!guild.voiceChannelIds.has(item.channelId)) errors.push(`${label}: choose a voice channel.`);
        else if (seen.has(item.channelId)) errors.push(`${label}: that voice channel is already used.`);
        seen.add(item.channelId);

        const categoryId = item.categoryId || null;
        if (categoryId && !guild.categoryIds.has(categoryId)) errors.push(`${label}: that category no longer exists.`);

        const nameTemplate =
            typeof item.nameTemplate === 'string' && item.nameTemplate.trim()
                ? item.nameTemplate.trim()
                : DEFAULT_TEMPLATE;
        if (nameTemplate.length > TEMP_VOICE_LIMITS.NAME_MAX)
            errors.push(`${label}: the name can be at most ${TEMP_VOICE_LIMITS.NAME_MAX} characters.`);

        const userLimit = Number(item.userLimit ?? 0);
        if (!Number.isInteger(userLimit) || userLimit < 0 || userLimit > TEMP_VOICE_LIMITS.USER_LIMIT_MAX) {
            errors.push(`${label}: the user limit must be from 0 (no limit) to ${TEMP_VOICE_LIMITS.USER_LIMIT_MAX}.`);
        }
        return { channelId: item.channelId, categoryId, nameTemplate, userLimit };
    });
    if (data.enabled === true && hubs.length === 0) errors.push('Add a join-to-create channel before turning it on.');

    return { settings: errors.length ? null : { enabled: data.enabled === true, hubs }, errors };
}

/**
 * @param {ReturnType<typeof tempVoiceView>} before
 * @param {ReturnType<typeof tempVoiceView>} after
 * @param {(id: string) => string} channelName
 */
function describe(before, after, channelName) {
    const changes = [];
    if (before.enabled !== after.enabled)
        changes.push(`Join-to-create: ${before.enabled ? 'on' : 'off'} → ${after.enabled ? 'on' : 'off'}`);
    const was = new Map(before.hubs.map((hub) => [hub.channelId, hub]));
    const now = new Map(after.hubs.map((hub) => [hub.channelId, hub]));
    for (const [id, hub] of now) {
        const old = was.get(id);
        if (!old) changes.push(`Added ${channelName(id)}`);
        else if (JSON.stringify(old) !== JSON.stringify(hub)) changes.push(`Changed ${channelName(id)}`);
    }
    for (const id of was.keys()) if (!now.has(id)) changes.push(`Removed ${channelName(id)}`);
    return changes;
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member
 * @param {{ op: string, settings?: unknown }} payload
 * @returns {Promise<Result>}
 */
export async function tempVoiceDashboard(guild, member, payload) {
    const channelName = (id) => `🔊 ${guild.channels.cache.get(id)?.name ?? 'deleted-channel'}`;
    const before = tempVoiceView(await Temp_Voice_Config_Cache.get(guild.id));

    if (payload.op === 'setup') {
        if (before.hubs.length >= TEMP_VOICE_LIMITS.HUBS_MAX) {
            return { ok: false, status: 400, error: `At most ${TEMP_VOICE_LIMITS.HUBS_MAX} join-to-create channels.` };
        }
        const me = guild.members.me;
        if (!me?.permissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers])) {
            return { ok: false, status: 400, error: 'Ovx needs the Manage Channels and Move Members permissions.' };
        }
        const reason = `Join-to-create set up on the Ovx dashboard by @${member.user.username}`;
        const category = await guild.channels.create({
            name: 'Voice Channels',
            type: ChannelType.GuildCategory,
            reason,
        });
        const hub = await guild.channels.create({
            name: '➕ Join to create',
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites: [
                // People join it only to be moved out, so nobody can talk in it
                { id: guild.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.Speak] },
                {
                    id: me.id,
                    type: OverwriteType.Member,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.MoveMembers,
                    ],
                },
            ],
            reason,
        });
        const after = tempVoiceView(
            await Temp_Voice_Config_Cache.set(guild.id, {
                enabled: true,
                hubs: [
                    ...before.hubs,
                    { channelId: hub.id, categoryId: category.id, nameTemplate: DEFAULT_TEMPLATE, userLimit: 0 },
                ],
            })
        );
        return {
            ok: true,
            data: after,
            changes: describe(before, after, channelName),
            action: 'Set up join-to-create voice',
        };
    }

    if (payload.op !== 'save') return { ok: false, status: 400, error: 'Unknown temp voice action' };
    const context = {
        voiceChannelIds: new Set(
            guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildVoice).keys()
        ),
        categoryIds: new Set(
            guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildCategory).keys()
        ),
    };
    const { settings, errors } = validateTempVoiceSettings(payload.settings, context);
    if (!settings) return { ok: false, status: 400, error: 'Some settings are not valid', details: errors };
    const after = tempVoiceView(await Temp_Voice_Config_Cache.set(guild.id, settings));
    return {
        ok: true,
        data: after,
        changes: describe(before, after, channelName),
        action: 'Updated join-to-create voice',
    };
}
