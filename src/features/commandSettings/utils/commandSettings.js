import { ApplicationCommandType, PermissionFlagsBits } from 'discord.js';
import { CATEGORIES, featureOf } from '../../utility/utils/help.js';

export const COMMAND_SETTINGS_LIMITS = Object.freeze({ CHANNELS_MAX: 25, ROLES_MAX: 25 });

/**
 * @typedef {import('../models/commandSettings.js').CommandSettingsType} CommandSettingsType
 * @typedef {import('../models/commandSettings.js').CommandRule} CommandRule
 */

/**
 * Why a member can't use a command here, as a translation key under commands.settings, or null if they can.
 * Members with Manage Server can always use every command, so admins never lock themselves out.
 * @param {import('discord.js').CommandInteraction<'cached'>} interaction
 * @param {CommandSettingsType} settings
 * @returns {{ key: string, vars?: Record<string, string> } | null}
 */
export function commandBlocker(interaction, settings) {
    if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return null;
    const name = interaction.commandName;
    if (settings.disabled.includes(name)) return { key: 'off' };

    const rule = settings.rules?.[name];
    if (!rule) return null;
    if (rule.channelIds?.length) {
        const channel = interaction.channel;
        // A thread counts as the channel it's in
        const parentId = channel?.isThread() ? channel.parentId : null;
        if (!rule.channelIds.includes(interaction.channelId) && !(parentId && rule.channelIds.includes(parentId))) {
            return { key: 'wrong_channel', vars: { channels: rule.channelIds.map((id) => `<#${id}>`).join(', ') } };
        }
    }
    if (rule.roleIds?.length && !rule.roleIds.some((roleId) => interaction.member.roles.cache.has(roleId))) {
        return { key: 'missing_role', vars: { roles: rule.roleIds.map((id) => `<@&${id}>`).join(', ') } };
    }
    return null;
}

/**
 * The commands a server can change: everything except developer tools, grouped like /help.
 * @param {import('discord.js').Client & { commands: Map<string, any> }} client
 */
export function commandList(client) {
    const category = (feature) => CATEGORIES.find((item) => item.features.includes(feature))?.id ?? 'utility';
    return [...(client.commands?.values() ?? [])]
        .filter((command) => !command.meta.developerOnly && featureOf(command) !== 'developer')
        .map((command) => {
            const json = /** @type {any} */ (command.commandData.toJSON());
            const menu = json.type === ApplicationCommandType.Message || json.type === ApplicationCommandType.User;
            return {
                name: json.name,
                description: menu ? null : json.description,
                menu,
                category: category(featureOf(command)),
                // Only usable in servers, or also in DMs; the settings only apply in servers either way
                serverOnly: !json.contexts || json.contexts.length === 1,
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** @param {CommandSettingsType} settings */
export function commandSettingsView(settings) {
    /** @type {Record<string, CommandRule>} */
    const rules = {};
    for (const [name, rule] of Object.entries(settings.rules ?? {})) {
        if (rule?.channelIds?.length || rule?.roleIds?.length) {
            rules[name] = { channelIds: [...(rule.channelIds ?? [])], roleIds: [...(rule.roleIds ?? [])] };
        }
    }
    return { disabled: [...settings.disabled], rules };
}

/**
 * @param {unknown} input
 * @param {import('../../../dashboard/validation.js').GuildContext} guild
 * @param {Set<string>} commandNames - Commands that exist
 */
export function validateCommandSettings(input, guild, commandNames) {
    const errors = [];
    const data = input && typeof input === 'object' ? /** @type {any} */ (input) : {};
    const L = COMMAND_SETTINGS_LIMITS;

    const disabled = Array.isArray(data.disabled)
        ? [...new Set(data.disabled.filter((name) => typeof name === 'string' && commandNames.has(name)))]
        : [];

    /** @type {Record<string, CommandRule>} */
    const rules = {};
    const raw = data.rules && typeof data.rules === 'object' ? data.rules : {};
    for (const [name, rule] of Object.entries(raw)) {
        if (!commandNames.has(name) || !rule || typeof rule !== 'object') continue;
        const ids = (value) => (Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === 'string'))] : []);
        const channelIds = ids(/** @type {any} */ (rule).channelIds);
        const roleIds = ids(/** @type {any} */ (rule).roleIds);
        if (channelIds.length > L.CHANNELS_MAX) errors.push(`/${name}: at most ${L.CHANNELS_MAX} channels.`);
        if (roleIds.length > L.ROLES_MAX) errors.push(`/${name}: at most ${L.ROLES_MAX} roles.`);
        if (channelIds.some((id) => !guild.channelIds.has(id)))
            errors.push(`/${name}: one of the channels no longer exists.`);
        if (roleIds.some((id) => !guild.roles.has(id))) errors.push(`/${name}: one of the roles no longer exists.`);
        if (channelIds.length || roleIds.length) rules[name] = { channelIds, roleIds };
    }
    return { settings: errors.length ? null : { disabled, rules }, errors };
}

/**
 * @param {ReturnType<typeof commandSettingsView>} before
 * @param {ReturnType<typeof commandSettingsView>} after
 * @param {{ channel: (id: string) => string, role: (id: string) => string }} names
 */
export function describeCommandChanges(before, after, names) {
    const changes = [
        ...after.disabled.filter((name) => !before.disabled.includes(name)).map((name) => `Turned off /${name}`),
        ...before.disabled.filter((name) => !after.disabled.includes(name)).map((name) => `Turned on /${name}`),
    ];
    const commands = new Set([...Object.keys(before.rules), ...Object.keys(after.rules)]);
    for (const name of [...commands].sort()) {
        const was = before.rules[name] ?? { channelIds: [], roleIds: [] };
        const now = after.rules[name] ?? { channelIds: [], roleIds: [] };
        const describe = (rule) =>
            [
                rule.channelIds.length ? `in ${rule.channelIds.map(names.channel).join(', ')}` : null,
                rule.roleIds.length ? `for ${rule.roleIds.map(names.role).join(', ')}` : null,
            ]
                .filter(Boolean)
                .join(' ') || 'anywhere, for anyone';
        if (describe(was) !== describe(now)) changes.push(`/${name}: ${describe(was)} → ${describe(now)}`);
    }
    return changes;
}
