import { DASHBOARD_LOG_TYPES } from './validation.js';
import { logSettings } from '../features/logging/models/logging.js';
import { ticketTypes } from '../features/tickets/utils/ticketTypes.js';

/**
 * Plain snapshots of a guild's settings, used by the dashboard API and to describe changes for the Web Logs.
 */

/**
 * Turns IDs into names for the Web Logs, as they are right now.
 * @param {import('discord.js').Guild} guild
 * @returns {import('./describeChanges.js').NameLookup}
 */
export function nameLookup(guild) {
    return {
        channel: (id) => {
            if (!id) return 'none';
            const channel = guild.channels.cache.get(id);
            return channel ? `#${channel.name}` : 'deleted channel';
        },
        role: (id) => {
            const role = guild.roles.cache.get(id);
            return role ? `@${role.name}` : 'deleted role';
        },
    };
}

/**
 * The logging settings the dashboard can see and edit.
 * Join and leave logs that were never set up show the member log settings they follow (see logSettings).
 * @param {import('../features/logging/models/logging.js').LogsConfigType} config
 */
export function loggingView(config) {
    const types = {};
    for (const type of DASHBOARD_LOG_TYPES) {
        const settings = logSettings(config, /** @type {any} */ (type));
        types[type] = { enabled: Boolean(settings?.enabled), channelId: settings?.channelId ?? null };
    }
    return { types, ignoredChannels: [...(config.ignoredChannels ?? [])] };
}

/**
 * The level settings the dashboard can see and edit (nothing internal like _id).
 * @param {import('../features/levels/models/guildLevels.js').GuildLevelsType} config
 */
export function levelsView(config) {
    return {
        enabled: Boolean(config.enabled),
        channelId: config.channelId ?? null,
        levelUpMessage: config.levelUpMessage ?? null,
        messageCooldown: config.messageCooldown,
        maxLevel: config.maxLevel,
        removePastRewards: Boolean(config.removePastRewards),
        publicLeaderboard: Boolean(config.publicLeaderboard),
        rewards: (config.rewards ?? []).map(({ level, roleId }) => ({ level, roleId })),
        blacklisted: {
            roleIds: [...(config.blacklisted?.roleIds ?? [])],
            channelIds: [...(config.blacklisted?.channelIds ?? [])],
        },
    };
}

/**
 * The auto role settings the dashboard can see and edit.
 * @param {import('../features/autoRoles/models/autoRoles.js').AutoRolesType} config
 * @param {(roleId: string) => boolean} [roleExists] - Drops deleted roles, so they can't block a save
 */
export function autoRolesView(config, roleExists = () => true) {
    return {
        enabled: Boolean(config.enabled),
        humanRoleIds: (config.humanRoleIds ?? []).filter(roleExists),
        botRoleIds: (config.botRoleIds ?? []).filter(roleExists),
    };
}

/**
 * The welcome and goodbye settings the dashboard can see and edit.
 * @param {import('../features/welcome/models/welcome.js').WelcomeType} config
 */
export function welcomeView(config) {
    const message = (value) => ({
        enabled: Boolean(value?.enabled),
        channelId: value?.channelId ?? null,
        message: value?.message ?? null,
        embed: Boolean(value?.embed),
        title: value?.title ?? null,
    });
    return { welcome: message(config.welcome), goodbye: message(config.goodbye) };
}

/**
 * The ticket settings the dashboard can see and edit.
 * @param {import('../features/tickets/models/ticketConfig.js').TicketConfigType} config
 * @param {(roleId: string) => boolean} [roleExists] - Drops deleted staff roles, so they can't block a save
 */
export function ticketsView(config, roleExists = () => true) {
    return {
        enabled: Boolean(config.enabled),
        categoryId: config.categoryId ?? null,
        transcriptChannelId: config.transcriptChannelId ?? null,
        staffRoleIds: (config.staffRoleIds ?? []).filter(roleExists),
        pingStaff: config.pingStaff !== false,
        maxOpenPerUser: config.maxOpenPerUser ?? 1,
        ownerCanClose: config.ownerCanClose !== false,
        dmTranscript: config.dmTranscript !== false,
        openMessage: config.openMessage ?? null,
        panel: {
            title: config.panel?.title ?? null,
            description: config.panel?.description ?? null,
            buttonLabel: config.panel?.buttonLabel ?? null,
        },
        // A server without its own types sees the one default type, so saving makes it a normal type
        ticketTypes: ticketTypes(config).map((type) => ({
            id: type.id,
            label: type.label,
            emoji: type.emoji ?? null,
            style: type.style ?? 'primary',
            description: type.description ?? null,
            channelPrefix: type.channelPrefix ?? null,
            categoryId: type.categoryId ?? null,
            staffRoleIds: (type.staffRoleIds ?? []).filter(roleExists),
            allowedRoleIds: (type.allowedRoleIds ?? []).filter(roleExists),
            openMessage: type.openMessage ?? null,
        })),
    };
}

/**
 * The moderation settings the dashboard can see and edit.
 * @param {import('../features/moderation/models/moderationConfig.js').ModerationConfigType} config
 */
export function moderationView(config) {
    return {
        warnActions: (config.warnActions ?? []).map(({ warnings, action, durationMs }) => ({
            warnings,
            action,
            durationMs: durationMs ?? null,
        })),
    };
}
