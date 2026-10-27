import { ChannelType, PermissionFlagsBits, DiscordAPIError, RESTJSONErrorCodes, EmbedBuilder } from 'discord.js';
import Guild_Level_Cache from '../features/levels/cache/guildLevels.cache.js';
import User_Levels_Cache from '../features/levels/cache/userLevels.cache.js';
import { ExpForLevel } from '../features/levels/utils/levels.js';
import Logs_Cache from '../features/logging/cache/logs.cache.js';
import { LOG_TYPES, logSettings } from '../features/logging/models/logging.js';
import Guild_Settings_Cache, { brandColour } from '../shared/cache/guildSettings.cache.js';
import Auto_Roles_Cache from '../features/autoRoles/cache/autoRoles.cache.js';
import Welcome_Cache from '../features/welcome/cache/welcome.cache.js';
import { DEFAULT_MESSAGES } from '../features/welcome/utils/welcomeMessage.js';
import Ticket_Config_Cache from '../features/tickets/cache/ticketConfig.cache.js';
import Moderation_Config_Cache from '../features/moderation/cache/moderationConfig.cache.js';
import { TICKET_DEFAULTS } from '../features/tickets/utils/components.js';
import { postPanel } from '../features/tickets/utils/panel.js';
import { StreamSubscription } from '../features/streams/models/streamSubscription.js';
import {
    addSubscription,
    listSubscriptions,
    platformStatus,
    streamLimit,
    STREAM_LIMITS,
} from '../features/streams/utils/subscriptions.js';
import { buildNotification, PLATFORMS, STREAM_DEFAULTS } from '../features/streams/utils/notification.js';
import { post as postNotification } from '../features/streams/utils/poller.js';
import {
    validateLevelSettings,
    validateLoggingSettings,
    validateBotSettings,
    validateAutoRoleSettings,
    validateWelcomeSettings,
    validateTicketSettings,
    validateModerationSettings,
    WARN_ACTION_LIMITS,
    validateStreamAdd,
    validateStreamUpdates,
    isSubscriptionId,
    STREAM_MESSAGE_MAX,
    TICKET_LIMITS,
    TICKET_TYPE_LIMITS,
    WELCOME_LIMITS,
    AUTO_ROLES_MAX,
    LIMITS,
    NICKNAME_MAX,
    BIO_MAX,
    IMAGE_MAX_BYTES,
} from './validation.js';
import {
    describeLevelChanges,
    describeLoggingChanges,
    describeBotChanges,
    describeAutoRoleChanges,
    describeWelcomeChanges,
    describeTicketChanges,
    describeStreamChanges,
    describeModerationChanges,
} from './describeChanges.js';
import {
    levelsView,
    loggingView,
    autoRolesView,
    welcomeView,
    ticketsView,
    moderationView,
    nameLookup,
} from './settingsViews.js';
import { giveawayDashboard } from '../features/giveaways/utils/dashboard.js';
import { reactionRolesDashboard } from '../features/reactionRoles/utils/dashboard.js';
import { customEmbedsDashboard } from '../features/customEmbeds/utils/dashboard.js';
import { automodDashboard } from '../features/automod/utils/dashboard.js';
import { ServerStats } from '../features/serverStats/models/serverStats.js';
import { autoMessagesDashboard, AUTO_MESSAGE_LIMITS } from '../features/autoMessages/utils/dashboard.js';
import { serverStatsDashboard, serverStatsView, SERVER_STATS_LIMITS } from '../features/serverStats/utils/dashboard.js';
import Command_Settings_Cache from '../features/commandSettings/cache/commandSettings.cache.js';
import {
    commandList,
    commandSettingsView,
    validateCommandSettings,
    describeCommandChanges,
    COMMAND_SETTINGS_LIMITS,
} from '../features/commandSettings/utils/commandSettings.js';
import { CATEGORIES } from '../features/utility/utils/help.js';
import { Translate } from '../shared/utils/i18n.js';
import Verification_Config_Cache from '../features/verification/cache/verificationConfig.cache.js';
import {
    verificationDashboard,
    verificationView,
    VERIFICATION_LIMITS,
} from '../features/verification/utils/dashboard.js';
import { suggestionsDashboard, SUGGESTION_LIMITS } from '../features/suggestions/utils/dashboard.js';
import Temp_Voice_Config_Cache from '../features/tempVoice/cache/tempVoiceConfig.cache.js';
import { tempVoiceDashboard, tempVoiceView, TEMP_VOICE_LIMITS } from '../features/tempVoice/utils/dashboard.js';
import { AUTOMOD_LIMITS } from '../features/automod/utils/settings.js';
import { CUSTOM_EMBED_LIMITS } from '../features/customEmbeds/utils/validation.js';
import Invite_Config_Cache from '../features/inviteBlocker/cache/inviteConfig.cache.js';
import Starboard_Config_Cache from '../features/starboard/cache/starboardConfig.cache.js';
import {
    starboardView,
    validateStarboardSettings,
    describeStarboardChanges,
    STARBOARD_LIMITS,
} from '../features/starboard/utils/settings.js';
import {
    inviteView,
    validateInviteSettings,
    describeInviteChanges,
    INVITE_LIMITS,
} from '../features/inviteBlocker/utils/settings.js';
import Honeypot_Config_Cache from '../features/honeypot/cache/honeypotConfig.cache.js';
import {
    honeypotView,
    validateHoneypotSettings,
    describeHoneypotChanges,
    HONEYPOT_LIMITS,
} from '../features/honeypot/utils/settings.js';
import { syncWarning as syncHoneypotWarning } from '../features/honeypot/utils/warning.js';
import { removePostedMessage } from '../shared/utils/postedMessage.js';
import { REACTION_ROLE_LIMITS } from '../features/reactionRoles/utils/validation.js';
import { GIVEAWAY_LIMITS } from '../features/giveaways/utils/validation.js';
import { votesEnabled, forgetVote } from '../features/votes/utils/votes.js';
import { LogData } from '../shared/utils/logger.js';
import { reportError } from '../shared/utils/errorReport.js';

/**
 * Dashboard actions that run inside a shard process (via client.dashboard()).
 * The dashboard server in the manager process routes each guild's requests to the shard that owns it.
 *
 * Permissions are checked here, against Discord's live data, on every request — never trusted from
 * the browser or the login session.
 *
 * Every handler returns a plain JSON-safe result:
 * { ok: true, data, changes? } or { ok: false, status, error, details? }
 * Saves include `changes` (human-readable descriptions for the Web Logs), which aren't sent to the browser.
 *
 * @typedef {import('discord.js').Client} Client
 * @typedef {{ ok: true, data: any, changes?: string[] } | { ok: false, status: number, error: string, details?: string[] }} Result
 */

const SNOWFLAKE = /^\d{17,20}$/;
const LEADERBOARD_TYPES = new Set(['level', 'totalMessages', 'totalVoice', 'totalCommands']);
// What the bot needs to post level-up messages and log embeds (see levels/utils/validation.js, logging/utils/logChannel.js)
const POST_EMBED_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
];

/** What the bot needs in a category to open tickets in it (see features/tickets/utils/access.js). */
const TICKET_CATEGORY_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
];

const handlers = {
    botGuilds,
    access,
    guildOverview,
    saveLevelSettings,
    saveLoggingSettings,
    testLogs,
    saveBotSettings,
    saveAutoRoleSettings,
    saveModerationSettings,
    saveInviteSettings,
    saveHoneypotSettings,
    postHoneypotWarning,
    saveStarboardSettings,
    saveWelcomeSettings,
    saveTicketSettings,
    postTicketPanel,
    addStream,
    saveStreams,
    removeStream,
    testStream,
    giveaways,
    reactionRoles,
    customEmbeds,
    automod,
    tempVoice,
    suggestions,
    saveVerification,
    saveCommandSettings,
    serverStats,
    autoMessages,
    logVote,
    voteReceived,
    resetSettings,
    leaderboard,
    stats,
};

/**
 * @param {Client} client
 * @param {string} action
 * @param {any} payload
 * @returns {Promise<Result>}
 */
export async function handle(client, action, payload) {
    if (!Object.hasOwn(handlers, action)) return fail(400, 'Unknown action');
    try {
        return await handlers[action](client, payload ?? {});
    } catch (error) {
        // Logged here, with the full stack, so a bug isn't mistaken for the shard being down:
        // the dashboard treats a request that throws as the bot being unreachable
        LogData('Dashboard', `${action} failed: ${error.stack ?? error.message}`, 'error');
        const guild = typeof payload?.guildId === 'string' ? (client.guilds.cache.get(payload.guildId) ?? null) : null;
        reportError(client, { source: `Dashboard: ${action}`, error, guild });
        return fail(500, 'Something went wrong. Try again, and if it keeps happening let the bot owner know.');
    }
}

/**
 * Which of these guild IDs this shard is in.
 * @param {Client} client
 * @param {{ guildIds: unknown }} payload
 */
async function botGuilds(client, { guildIds }) {
    if (!Array.isArray(guildIds) || guildIds.length > 250) return fail(400, 'Invalid guild list');
    return ok(guildIds.filter((id) => typeof id === 'string' && client.guilds.cache.has(id)));
}

/**
 * Just the live Manage Server check, for requests answered elsewhere (e.g. Web Logs from the database).
 * @param {Client} client
 * @param {{ guildId: string, userId: string }} payload
 */
async function access(client, { guildId, userId }) {
    const result = await getManagedGuild(client, guildId, userId);
    return result.ok ? ok(true) : result;
}

/**
 * Everything the settings page needs: guild info, channels, roles and the current level settings.
 * @param {Client} client
 * @param {{ guildId: string, userId: string }} payload
 */
async function guildOverview(client, { guildId, userId }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const [config, logsConfig, botSettings, autoRoles, welcome, tickets, moderation] = await Promise.all([
        Guild_Level_Cache.get(guild.id),
        Logs_Cache.get(guild.id),
        Guild_Settings_Cache.get(guild.id),
        Auto_Roles_Cache.get(guild.id),
        Welcome_Cache.get(guild.id),
        Ticket_Config_Cache.get(guild.id),
        Moderation_Config_Cache.get(guild.id),
    ]);
    const me = guild.members.me;

    const channels = guild.channels.cache
        .filter((channel) => !channel.isThread() && channel.type !== ChannelType.GuildCategory)
        .sort((a, b) => ('rawPosition' in a && 'rawPosition' in b ? a.rawPosition - b.rawPosition : 0))
        .map((channel) => ({
            id: channel.id,
            name: channel.name,
            type: channel.isVoiceBased() ? 'voice' : channel.isTextBased() ? 'text' : 'other',
            category: channel.parent?.name ?? null,
            botCanPost: canPostEmbeds(channel, me),
            // For the Levels page: Ovx only sees messages in channels it can view
            botCanView: me.permissionsIn(channel).has(PermissionFlagsBits.ViewChannel),
            afk: channel.id === guild.afkChannelId,
        }));

    const roles = guild.roles.cache
        .filter((role) => role.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => ({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            position: role.position,
            managed: role.managed,
            assignable: !role.managed && role.position < me.roles.highest.position,
        }));

    return ok({
        guild: {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ size: 128 }),
            memberCount: guild.memberCount,
        },
        channels,
        roles,
        levels: levelsView(config),
        logging: loggingView(logsConfig),
        bot: botView(guild, botSettings),
        autoRoles: autoRolesView(autoRoles, roleExists(guild)),
        welcome: welcomeView(welcome),
        welcomeDefaults: DEFAULT_MESSAGES,
        tickets: ticketsView(tickets, roleExists(guild)),
        ticketPanel: { channelId: tickets.panel?.channelId ?? null, posted: Boolean(tickets.panel?.messageId) },
        ticketDefaults: TICKET_DEFAULTS,
        moderation: moderationView(moderation),
        inviteBlocker: inviteView(await Invite_Config_Cache.get(guild.id)),
        honeypot: honeypotView(await Honeypot_Config_Cache.get(guild.id)),
        starboard: starboardView(await Starboard_Config_Cache.get(guild.id)),
        tempVoice: tempVoiceView(await Temp_Voice_Config_Cache.get(guild.id)),
        verification: verificationView(await Verification_Config_Cache.get(guild.id)),
        commands: commandList(client),
        commandCategories: CATEGORIES.map(({ id, emoji }) => ({
            id,
            emoji,
            name: Translate(`commands.help.categories.${id}.name`, 'en-GB'),
        })),
        commandSettings: commandSettingsView(await Command_Settings_Cache.get(guild.id)),
        streams: await listSubscriptions(guild.id),
        streamStatus: platformStatus(),
        streamLimit: await streamLimit(guild.id),
        streamDefaults: STREAM_DEFAULTS,
        emojis: guild.emojis.cache
            .filter((emoji) => emoji.available !== false)
            .map((emoji) => ({
                id: emoji.id,
                name: emoji.name,
                animated: Boolean(emoji.animated),
                url: emoji.imageURL({ size: 64 }),
            })),
        categories: guild.channels.cache
            .filter((channel) => channel.type === ChannelType.GuildCategory)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map((category) => ({
                id: category.id,
                name: category.name,
                botCanUse: me.permissionsIn(category).has(TICKET_CATEGORY_PERMISSIONS),
            })),
        botPermissions: {
            manageRoles: me.permissions.has(PermissionFlagsBits.ManageRoles),
            moveMembers: me.permissions.has(PermissionFlagsBits.MoveMembers),
            manageChannels: me.permissions.has(PermissionFlagsBits.ManageChannels),
            banMembers: me.permissions.has(PermissionFlagsBits.BanMembers),
        },
        limits: {
            ...LIMITS,
            NICKNAME_MAX,
            BIO_MAX,
            IMAGE_MAX_BYTES,
            AUTO_ROLES_MAX,
            WELCOME: WELCOME_LIMITS,
            TICKETS: TICKET_LIMITS,
            TICKET_TYPES: TICKET_TYPE_LIMITS,
            STREAMS: { ...STREAM_LIMITS, MESSAGE_MAX: STREAM_MESSAGE_MAX },
            WARN_ACTIONS: WARN_ACTION_LIMITS,
            GIVEAWAYS: GIVEAWAY_LIMITS,
            REACTION_ROLES: REACTION_ROLE_LIMITS,
            INVITES: INVITE_LIMITS,
            HONEYPOT: HONEYPOT_LIMITS,
            STARBOARD: STARBOARD_LIMITS,
            AUTOMOD: AUTOMOD_LIMITS,
            TEMP_VOICE: TEMP_VOICE_LIMITS,
            SUGGESTIONS: SUGGESTION_LIMITS,
            VERIFICATION: VERIFICATION_LIMITS,
            COMMANDS: COMMAND_SETTINGS_LIMITS,
            SERVER_STATS: SERVER_STATS_LIMITS,
            AUTO_MESSAGES: AUTO_MESSAGE_LIMITS,
            CUSTOM_EMBEDS: CUSTOM_EMBED_LIMITS,
        },
        votesEnabled: votesEnabled(),
    });
}

/**
 * The Giveaways page: list, create, end, reroll, cancel and delete giveaways, and save its settings.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, op: string, giveawayId?: unknown, giveaway?: unknown, settings?: unknown, count?: unknown }} payload
 */
async function giveaways(client, { guildId, userId, ...payload }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const context = guildContext(access.guild);
    return giveawayDashboard(access.guild, access.member, payload, {
        textChannelIds: context.textChannelIds,
        roleIds: new Set(context.roles.keys()),
    });
}

/**
 * The Reaction Roles page: list, save (which posts or updates the message) and delete panels.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, op: string, panelId?: unknown, panel?: unknown }} payload
 */
async function reactionRoles(client, { guildId, userId, ...payload }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    return reactionRolesDashboard(access.guild, payload, guildContext(access.guild));
}

/**
 * The Custom Embeds page: list, save (which posts or updates the message) and delete custom messages.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, op: string, messageId?: unknown, message?: unknown }} payload
 */
async function customEmbeds(client, { guildId, userId, ...payload }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    return customEmbedsDashboard(access.guild, payload, guildContext(access.guild));
}

/**
 * The AutoMod page: Discord AutoMod rules made by Ovx, and anti-raid.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, op: string, settings?: unknown }} payload
 */
async function automod(client, { guildId, userId, ...payload }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    return automodDashboard(access.guild, access.member, payload, guildContext(access.guild), nameLookup(access.guild));
}

/**
 * The Temp Voice page: join-to-create channels.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, op: string, settings?: unknown }} payload
 */
async function tempVoice(client, { guildId, userId, ...payload }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    return tempVoiceDashboard(access.guild, access.member, payload);
}

/**
 * The Suggestions page: settings, and deciding or deleting suggestions.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, op: string }} payload
 */
async function suggestions(client, { guildId, userId, ...payload }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    return suggestionsDashboard(
        access.guild,
        access.member,
        payload,
        guildContext(access.guild),
        nameLookup(access.guild)
    );
}

/**
 * The Verification page: saves the settings and posts or updates the panel.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveVerification(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    return verificationDashboard(access.guild, { settings }, guildContext(access.guild), nameLookup(access.guild));
}

/**
 * The Commands page: commands turned off, or limited to some channels or roles.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveCommandSettings(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const names = new Set(commandList(client).map((command) => command.name));
    const { settings: valid, errors } = validateCommandSettings(settings, guildContext(guild), names);
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    const before = commandSettingsView(await Command_Settings_Cache.get(guild.id));
    const after = commandSettingsView(await Command_Settings_Cache.set(guild.id, valid));
    return { ok: true, data: after, changes: describeCommandChanges(before, after, nameLookup(guild)) };
}

/**
 * The Server Stats page: counter channels.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, op: string }} payload
 */
async function serverStats(client, { guildId, userId, ...payload }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    if (payload.op === 'get') {
        return ok(serverStatsView(access.guild, await ServerStats.findOne({ guildId: access.guild.id }).lean()));
    }
    return serverStatsDashboard(access.guild, access.member, payload);
}

/**
 * The Auto Messages page: repeating messages and sticky messages.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, op: string }} payload
 */
async function autoMessages(client, { guildId, userId, ...payload }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    return autoMessagesDashboard(access.guild, payload, guildContext(access.guild));
}

/**
 * A vote arrived: this shard drops its cached vote status for them, so their XP bonus starts at once.
 * @param {Client} client
 * @param {{ userId: unknown }} payload
 */
async function voteReceived(client, { userId }) {
    if (typeof userId !== 'string' || !SNOWFLAKE.test(userId)) return fail(400, 'Invalid user');
    forgetVote(userId);
    return ok(true);
}

/**
 * Posts a Top.gg vote to the developer vote log channel. Run on one shard by the dashboard's webhook.
 * @param {Client} client
 * @param {{ userId: unknown, votes: unknown }} payload
 */
async function logVote(client, { userId, votes }) {
    if (typeof userId !== 'string' || !SNOWFLAKE.test(userId)) return fail(400, 'Invalid user');
    const embed = new EmbedBuilder()
        .setColor('#b69cff')
        .setTitle('New vote')
        .setDescription(`<@${userId}> voted for Ovx on Top.gg ❤️`)
        .setFooter({ text: `User ID: ${userId}${typeof votes === 'number' ? ` · ${votes} votes in total` : ''}` })
        .setTimestamp();
    await /** @type {any} */ (client).utils.DevEmbed('vote', client, embed);
    return ok(true);
}

/**
 * Validates and saves level settings, through the shard's cache so the bot sees them instantly.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveLevelSettings(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const current = await Guild_Level_Cache.get(guild.id);
    const { settings: valid, errors } = validateLevelSettings(settings, guildContext(guild), current);
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    const before = levelsView(current);
    const after = levelsView(await Guild_Level_Cache.set(guild.id, valid));
    return { ok: true, data: after, changes: describeLevelChanges(before, after, nameLookup(guild)) };
}

/**
 * Validates and saves logging settings, through the shard's logs cache so log events see them instantly.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveLoggingSettings(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const { settings: valid, errors } = validateLoggingSettings(settings, guildContext(guild));
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    const before = loggingView(await Logs_Cache.get(guild.id));
    const after = loggingView(await Logs_Cache.set(guild.id, valid));
    return { ok: true, data: after, changes: describeLoggingChanges(before, after, nameLookup(guild)) };
}

/**
 * Changes the bot's profile in this server (nickname, avatar, banner, About Me) and its embed colour.
 * The change shows in the server's Discord audit log with who made it on the dashboard.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveBotSettings(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;

    const { settings: valid, errors } = validateBotSettings(settings);
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    return applyBotSettings(access.guild, access.member, valid);
}

/**
 * Applies already-validated bot settings (from validateBotSettings, or known values for a reset).
 * Only what actually differs is sent to Discord, since profile changes are rate limited.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member - Who is making the change, for Discord's audit log
 * @param {ReturnType<typeof validateBotSettings>['settings']} valid
 * @returns {Promise<Result>}
 */
async function applyBotSettings(guild, member, valid) {
    const stored = await Guild_Settings_Cache.get(guild.id);
    const before = botView(guild, stored);

    /** @type {import('discord.js').GuildMemberEditMeOptions} */
    const profile = {};
    if (valid.nickname !== undefined && valid.nickname !== before.nickname) profile.nick = valid.nickname;
    // A new image is always a change; removing one only if there is one
    if (valid.avatar !== undefined && (valid.avatar || before.customAvatar)) profile.avatar = valid.avatar;
    if (valid.banner !== undefined && (valid.banner || before.banner)) profile.banner = valid.banner;
    if (valid.bio !== undefined && valid.bio !== before.bio) profile.bio = valid.bio;

    const stores = {};
    if (valid.embedColour !== undefined && valid.embedColour !== before.embedColour) {
        stores.embedColour = valid.embedColour;
    }
    if (profile.bio !== undefined) stores.bio = profile.bio;

    if ('nick' in profile && !before.canChangeNickname) {
        return fail(400, 'Ovx needs the Change Nickname permission in this server to change its nickname');
    }

    let me = guild.members.me;
    if (Object.keys(profile).length > 0) {
        try {
            // Returns the updated member; the cached one only changes once Discord's update event arrives
            me = await guild.members.editMe({
                ...profile,
                reason: `Changed on the Ovx dashboard by ${member.user.username} (${member.id})`,
            });
        } catch (error) {
            const message = discordProfileError(error);
            if (message) return fail(400, message);
            throw error;
        }
    }

    const saved = Object.keys(stores).length > 0 ? await Guild_Settings_Cache.set(guild.id, stores) : stored;
    const after = botView(guild, saved, me);
    return { ok: true, data: after, changes: describeBotChanges(before, after) };
}

/**
 * Turns Discord's refusal of a profile change into something to show the user, or null if it's unexpected.
 * @param {unknown} error
 * @returns {string | null}
 */
function discordProfileError(error) {
    if (!(error instanceof DiscordAPIError)) return null;
    if (error.code === RESTJSONErrorCodes.MissingPermissions) {
        return 'Ovx needs the Change Nickname permission in this server to change its nickname';
    }
    if (error.code !== RESTJSONErrorCodes.InvalidFormBodyOrContentType) return null;

    // Discord says which field it refused and why, e.g. "You are changing your avatar too fast"
    const labels = { nick: 'Nickname', avatar: 'Avatar', banner: 'Banner', bio: 'About Me' };
    const fields = /** @type {any} */ (error.rawError)?.errors ?? {};
    for (const [field, label] of Object.entries(labels)) {
        const reason = fields[field]?._errors?.[0]?.message;
        if (typeof reason === 'string') return `${label}: ${reason}`;
    }
    return 'Discord did not accept these changes. Try a different nickname or image.';
}

/**
 * Validates and saves the automatic actions taken when a member reaches a number of warnings.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveModerationSettings(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const { settings: valid, errors } = validateModerationSettings(settings);
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    const before = moderationView(await Moderation_Config_Cache.get(guild.id));
    const after = moderationView(await Moderation_Config_Cache.set(guild.id, valid));
    return { ok: true, data: after, changes: describeModerationChanges(before, after) };
}

/**
 * Validates and saves the invite blocker's settings, through its cache so new messages are checked with them at once.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveInviteSettings(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const { settings: valid, errors } = validateInviteSettings(settings, guildContext(guild));
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    const before = inviteView(await Invite_Config_Cache.get(guild.id));
    const after = inviteView(await Invite_Config_Cache.set(guild.id, valid));
    return { ok: true, data: after, changes: describeInviteChanges(before, after, nameLookup(guild)) };
}

/**
 * Validates and saves the honeypot channel's settings, through its cache so new messages are checked with them at once.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveHoneypotSettings(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const { settings: valid, errors } = validateHoneypotSettings(settings, guildContext(guild));
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    const before = honeypotView(await Honeypot_Config_Cache.get(guild.id));
    // The settings are saved even if the warning can't be posted; the page says why
    const { config, error } = await syncHoneypotWarning(guild, await Honeypot_Config_Cache.set(guild.id, valid));
    const after = honeypotView(config);
    return {
        ok: true,
        data: { ...after, warningError: error ?? null },
        changes: describeHoneypotChanges(before, after, nameLookup(guild)),
    };
}

/**
 * Posts the honeypot warning again (or updates it), e.g. after someone deleted it.
 * @param {Client} client
 * @param {{ guildId: string, userId: string }} payload
 */
async function postHoneypotWarning(client, { guildId, userId }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const current = await Honeypot_Config_Cache.get(guild.id);
    if (!current.enabled || !current.postWarning || !current.channelId) {
        return fail(400, 'Turn the honeypot and its warning message on first');
    }
    const { config, error } = await syncHoneypotWarning(guild, current);
    if (error) return fail(400, error);
    return {
        ok: true,
        data: honeypotView(config),
        changes: [`Posted the honeypot warning in ${nameLookup(guild).channel(config.channelId)}`],
    };
}

/**
 * Validates and saves the starboard settings, through its cache so reactions use them at once.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveStarboardSettings(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const { settings: valid, errors } = validateStarboardSettings(settings, guildContext(guild));
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    const before = starboardView(await Starboard_Config_Cache.get(guild.id));
    const after = starboardView(await Starboard_Config_Cache.set(guild.id, valid));
    return { ok: true, data: after, changes: describeStarboardChanges(before, after, nameLookup(guild)) };
}

/**
 * Validates and saves the roles given to new members.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveAutoRoleSettings(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const { settings: valid, errors } = validateAutoRoleSettings(settings, guildContext(guild));
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    const exists = roleExists(guild);
    const before = autoRolesView(await Auto_Roles_Cache.get(guild.id), exists);
    const after = autoRolesView(await Auto_Roles_Cache.set(guild.id, valid), exists);
    return { ok: true, data: after, changes: describeAutoRoleChanges(before, after, nameLookup(guild)) };
}

/**
 * Validates and saves the welcome and goodbye messages.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveWelcomeSettings(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const { settings: valid, errors } = validateWelcomeSettings(settings, guildContext(guild));
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    const before = welcomeView(await Welcome_Cache.get(guild.id));
    const after = welcomeView(await Welcome_Cache.set(guild.id, valid));
    return { ok: true, data: after, changes: describeWelcomeChanges(before, after, nameLookup(guild)) };
}

/**
 * Validates and saves the ticket settings.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function saveTicketSettings(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const current = await Ticket_Config_Cache.get(guild.id);
    const { settings: valid, errors } = validateTicketSettings(settings, guildContext(guild), current);
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    const exists = roleExists(guild);
    const before = ticketsView(current, exists);
    const after = ticketsView(await Ticket_Config_Cache.set(guild.id, valid), exists);
    return { ok: true, data: after, changes: describeTicketChanges(before, after, nameLookup(guild)) };
}

/**
 * Posts the "Create Ticket" panel in a channel, or updates the one already there.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, channelId: unknown }} payload
 */
async function postTicketPanel(client, { guildId, userId, channelId }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    if (typeof channelId !== 'string' || !guildContext(guild).textChannelIds.has(channelId)) {
        return fail(400, 'Choose a text channel the bot can post in');
    }
    const result = /** @type {any} */ (await postPanel(guild, channelId));
    if (!result.ok) {
        return fail(
            400,
            result.reason === 'bot_permissions'
                ? `Ovx is missing permissions in that channel: ${result.missing.join(', ')}`
                : 'Choose a text channel the bot can post in'
        );
    }

    const channelName = nameLookup(guild).channel(channelId);
    return {
        ok: true,
        data: { channelId, posted: true, messageUrl: result.messageUrl },
        changes: [
            result.updated ? `Updated the ticket panel in ${channelName}` : `Posted the ticket panel in ${channelName}`,
        ],
    };
}

/** What to tell someone when following a streamer didn't work. */
const ADD_STREAM_ERRORS = {
    not_configured: (platform) => `${platform} notifications aren't set up on this bot yet.`,
    limit: (platform, result) =>
        `This server can follow up to ${result.max} streamers${result.premium ? '' : ` (${STREAM_LIMITS.PREMIUM} with premium)`}. Remove one first.`,
    not_found: (platform) => `Couldn't find that ${platform} channel. Check the name or link.`,
    duplicate: (platform) => `That ${platform} channel is already followed.`,
    platform_error: (platform) => `${platform} couldn't be reached. Try again in a moment.`,
};

/**
 * Follows a streamer (looked up on the platform).
 * @param {Client} client
 * @param {{ guildId: string, userId: string, settings: unknown }} payload
 */
async function addStream(client, { guildId, userId, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;

    const { settings: valid, errors } = validateStreamAdd(settings, guildContext(guild));
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    const result = /** @type {any} */ (await addSubscription(/** @type {any} */ ({ guildId: guild.id, ...valid })));
    if (!result.ok) return fail(400, ADD_STREAM_ERRORS[result.reason](PLATFORMS[valid.platform].name, result));

    return {
        ok: true,
        data: { subscription: result.subscription, limit: await streamLimit(guild.id) },
        changes: describeStreamChanges([], [result.subscription], nameLookup(guild)),
    };
}

/**
 * Saves changes to the followed streamers on one platform.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, platform: unknown, settings: unknown }} payload
 */
async function saveStreams(client, { guildId, userId, platform, settings }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;
    if (typeof platform !== 'string' || !Object.hasOwn(PLATFORMS, platform)) return fail(400, 'Unknown platform');

    const before = await listSubscriptions(guild.id, /** @type {any} */ (platform));
    const existing = new Map(before.map((subscription) => [subscription.id, subscription.account.displayName]));
    const { settings: updates, errors } = validateStreamUpdates(settings, guildContext(guild), existing);
    if (errors.length > 0) return fail(400, 'Some settings are not valid', errors);

    await StreamSubscription.bulkWrite(
        /** @type {any} */ (updates).map(({ id, ...changes }) => ({
            updateOne: { filter: { _id: id, guildId: guild.id, platform }, update: { $set: changes } },
        }))
    );
    const after = await listSubscriptions(guild.id, /** @type {any} */ (platform));
    return { ok: true, data: after, changes: describeStreamChanges(before, after, nameLookup(guild)) };
}

/**
 * Unfollows a streamer.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, subscriptionId: unknown }} payload
 */
async function removeStream(client, { guildId, userId, subscriptionId }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;
    if (!isSubscriptionId(subscriptionId)) return fail(404, 'That streamer is not followed');

    const removed = await StreamSubscription.findOneAndDelete({ _id: subscriptionId, guildId: guild.id }).lean();
    if (!removed) return fail(404, 'That streamer is not followed');

    const { subscriptionView } = await import('../features/streams/utils/subscriptions.js');
    return {
        ok: true,
        data: { limit: await streamLimit(guild.id) },
        changes: describeStreamChanges([subscriptionView(removed)], [], nameLookup(guild)),
    };
}

/** Log type names as the dashboard shows them */
const LOG_TYPE_NAMES = {
    message: 'Messages',
    join: 'Joins',
    leave: 'Leaves',
    member: 'Members',
    punishment: 'Punishments',
    channel: 'Channels',
    role: 'Roles',
    voice: 'Voice',
    server: 'Server',
};
const TEST_LOGS_COOLDOWN_MS = 30_000;
/** Guild ID → when its test logs were last sent, so the button can't be used to spam log channels */
const lastLogTest = new Map();

/**
 * Posts a test message in the channel of every log type that is switched on, and reports which worked.
 * Unlike real logs, a failure here doesn't switch the type off: the result tells the user what to fix.
 * @param {Client} client
 * @param {{ guildId: string, userId: string }} payload
 */
async function testLogs(client, { guildId, userId }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild, member } = access;

    const waitMs = (lastLogTest.get(guild.id) ?? 0) + TEST_LOGS_COOLDOWN_MS - Date.now();
    if (waitMs > 0) return fail(429, `Test logs were just sent. Try again in ${Math.ceil(waitMs / 1000)} seconds.`);

    const config = await Logs_Cache.get(guild.id);
    const types = LOG_TYPES.filter((type) => {
        const settings = logSettings(config, type);
        return settings?.enabled && settings.channelId;
    });
    if (types.length === 0)
        return fail(400, 'No log types are switched on yet. Choose a channel, switch one on and save.');
    lastLogTest.set(guild.id, Date.now());

    const colour = await brandColour(guild.id);
    const results = [];
    for (const type of types) {
        const channel = guild.channels.cache.get(logSettings(config, type).channelId);
        if (!channel?.isTextBased()) {
            results.push({ type, ok: false, error: 'The channel no longer exists' });
            continue;
        }
        if (!canPostEmbeds(channel, guild.members.me)) {
            results.push({ type, ok: false, error: `Ovx can't post embeds in #${channel.name}` });
            continue;
        }

        const embed = new EmbedBuilder()
            .setColor(colour)
            .setTitle('Test log')
            .setDescription(`**${LOG_TYPE_NAMES[type]}** logs will be posted in this channel.`)
            .setFooter({ text: `Sent from the dashboard by ${member.user.username}` })
            .setTimestamp();
        try {
            await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
            results.push({ type, ok: true, channel: channel.name });
        } catch (error) {
            results.push({ type, ok: false, error: `Couldn't post in #${channel.name}: ${error.message}` });
        }
    }
    return ok({ results });
}

/**
 * Posts an example notification, so people can see what it looks like (and that the bot can post there).
 * @param {Client} client
 * @param {{ guildId: string, userId: string, subscriptionId: unknown }} payload
 */
async function testStream(client, { guildId, userId, subscriptionId }) {
    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild } = access;
    if (!isSubscriptionId(subscriptionId)) return fail(404, 'That streamer is not followed');

    const subscription = await StreamSubscription.findOne({ _id: subscriptionId, guildId: guild.id }).lean();
    if (!subscription) return fail(404, 'That streamer is not followed');

    const kind = subscription.platform === 'youtube' && !subscription.notifyLive ? 'video' : 'live';
    const example = {
        id: 'test',
        title: 'This is a test notification',
        game: kind === 'live' && subscription.platform !== 'youtube' ? 'Just Chatting' : null,
        viewers: kind === 'live' ? 123 : null,
        startedAt: new Date(),
        publishedAt: new Date(),
        thumbnail: null,
        url: subscription.url,
    };
    const sent = await postNotification(
        client,
        subscription,
        buildNotification(kind, /** @type {any} */ (subscription), example)
    );
    return sent
        ? ok({ sent: true })
        : fail(400, "Couldn't post in that channel. Check Ovx can see it and send messages and embeds.");
}

/** Sections that can be reset to their defaults. Members' XP and levels are never touched. */
const RESET_SECTIONS = new Set([
    'levels',
    'logging',
    'bot',
    'auto-roles',
    'welcome',
    'tickets',
    'twitch',
    'youtube',
    'kick',
    'moderation',
    'invites',
    'honeypot',
    'starboard',
    'commands',
]);

/**
 * Puts one settings section back to its defaults.
 * @param {Client} client
 * @param {{ guildId: string, userId: string, section: unknown }} payload
 */
async function resetSettings(client, { guildId, userId, section }) {
    if (typeof section !== 'string' || !RESET_SECTIONS.has(section)) return fail(400, 'Unknown settings section');

    const access = await getManagedGuild(client, guildId, userId);
    if (!access.ok) return access;
    const { guild, member } = access;
    const names = nameLookup(guild);

    if (section === 'levels') {
        const before = levelsView(await Guild_Level_Cache.get(guild.id));
        const defaults = Guild_Level_Cache.createDefault(guild.id);
        delete defaults.guildId; // Only the settings are written
        const after = levelsView(await Guild_Level_Cache.set(guild.id, defaults));
        return { ok: true, data: after, changes: describeLevelChanges(before, after, names) };
    }

    if (section === 'logging') {
        const before = loggingView(await Logs_Cache.get(guild.id));
        const off = Object.fromEntries(LOG_TYPES.map((type) => [type, { enabled: false, channelId: null }]));
        const after = loggingView(await Logs_Cache.set(guild.id, { ...off, ignoredChannels: [] }));
        return { ok: true, data: after, changes: describeLoggingChanges(before, after, names) };
    }

    if (Object.hasOwn(PLATFORMS, section)) {
        const before = await listSubscriptions(guild.id, /** @type {any} */ (section));
        await StreamSubscription.deleteMany({ guildId: guild.id, platform: /** @type {any} */ (section) });
        return { ok: true, data: [], changes: describeStreamChanges(before, [], names) };
    }

    if (section === 'tickets') {
        const exists = roleExists(guild);
        const before = ticketsView(await Ticket_Config_Cache.get(guild.id), exists);
        // Ticket numbers keep counting, and the panel stays where it is so posting it again updates it
        const defaults = Ticket_Config_Cache.createDefault(guild.id);
        const { panel } = defaults;
        delete defaults.guildId;
        delete defaults.lastTicketNumber;
        delete defaults.panel;
        const after = ticketsView(
            await Ticket_Config_Cache.set(guild.id, {
                ...defaults,
                'panel.title': panel.title,
                'panel.description': panel.description,
                'panel.buttonLabel': panel.buttonLabel,
            }),
            exists
        );
        return { ok: true, data: after, changes: describeTicketChanges(before, after, names) };
    }

    if (section === 'welcome') {
        const before = welcomeView(await Welcome_Cache.get(guild.id));
        const defaults = Welcome_Cache.createDefault(guild.id);
        const after = welcomeView(
            await Welcome_Cache.set(guild.id, { welcome: defaults.welcome, goodbye: defaults.goodbye })
        );
        return { ok: true, data: after, changes: describeWelcomeChanges(before, after, names) };
    }

    // Only the automatic actions: moderation cases are members' records and are never reset
    if (section === 'moderation') {
        const before = moderationView(await Moderation_Config_Cache.get(guild.id));
        const after = moderationView(await Moderation_Config_Cache.set(guild.id, { warnActions: [] }));
        return { ok: true, data: after, changes: describeModerationChanges(before, after) };
    }

    if (section === 'commands') {
        const before = commandSettingsView(await Command_Settings_Cache.get(guild.id));
        const after = commandSettingsView(await Command_Settings_Cache.reset(guild.id));
        return { ok: true, data: after, changes: describeCommandChanges(before, after, names) };
    }

    if (section === 'starboard') {
        const before = starboardView(await Starboard_Config_Cache.get(guild.id));
        const after = starboardView(await Starboard_Config_Cache.reset(guild.id));
        return { ok: true, data: after, changes: describeStarboardChanges(before, after, names) };
    }

    if (section === 'invites') {
        const before = inviteView(await Invite_Config_Cache.get(guild.id));
        const after = inviteView(await Invite_Config_Cache.reset(guild.id));
        return { ok: true, data: after, changes: describeInviteChanges(before, after, names) };
    }

    if (section === 'honeypot') {
        const current = await Honeypot_Config_Cache.get(guild.id);
        const before = honeypotView(current);
        if (current.warningMessageId) {
            await removePostedMessage(guild, {
                channelId: current.warningChannelId,
                messageId: current.warningMessageId,
            });
        }
        const after = honeypotView(await Honeypot_Config_Cache.reset(guild.id));
        return { ok: true, data: after, changes: describeHoneypotChanges(before, after, names) };
    }

    if (section === 'auto-roles') {
        const exists = roleExists(guild);
        const before = autoRolesView(await Auto_Roles_Cache.get(guild.id), exists);
        const after = autoRolesView(
            await Auto_Roles_Cache.set(guild.id, { enabled: false, humanRoleIds: [], botRoleIds: [] }),
            exists
        );
        return { ok: true, data: after, changes: describeAutoRoleChanges(before, after, names) };
    }

    return applyBotSettings(guild, member, {
        nickname: null,
        avatar: null,
        banner: null,
        bio: null,
        embedColour: null,
    });
}

/**
 * Leaderboard entries with display names and avatars.
 * Without a viewerId this is a public request, allowed only if the guild opted in.
 * @param {Client} client
 * @param {{ guildId: string, type: unknown, limit: unknown, viewerId?: string }} payload
 */
async function leaderboard(client, { guildId, type, limit, viewerId }) {
    if (typeof type !== 'string' || !LEADERBOARD_TYPES.has(type)) return fail(400, 'Unknown leaderboard type');
    const size = typeof limit === 'number' && Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : 50;

    let guild;
    if (viewerId) {
        const access = await getManagedGuild(client, guildId, viewerId);
        if (!access.ok) return access;
        guild = access.guild;
    } else {
        guild = typeof guildId === 'string' && SNOWFLAKE.test(guildId) ? client.guilds.cache.get(guildId) : undefined;
    }
    // Same response whether the bot isn't in the guild or it's private, so IDs can't be probed
    if (!guild) return fail(404, 'Leaderboard not found');

    const config = await Guild_Level_Cache.get(guild.id);
    if (!viewerId && !config.publicLeaderboard) return fail(404, 'Leaderboard not found');

    const topUsers = await User_Levels_Cache.getTopUsers(guild.id, /** @type {any} */ (type), size);

    // One request for all members not already cached; users who left the server show as unknown
    const missing = topUsers.map((user) => user.userId).filter((id) => !guild.members.cache.has(id));
    if (missing.length > 0) await guild.members.fetch({ user: missing }).catch(() => null);

    const entries = topUsers.map((user, index) => {
        const member = guild.members.cache.get(user.userId);
        const xpIntoLevel = user.xp - ExpForLevel(user.level);
        const xpForNextLevel = ExpForLevel(user.level + 1) - ExpForLevel(user.level);
        return {
            rank: index + 1,
            userId: user.userId,
            name: member?.displayName ?? 'Unknown user',
            avatar: member?.displayAvatarURL({ size: 64 }) ?? null,
            level: user.level,
            xp: user.xp,
            xpIntoLevel,
            xpForNextLevel,
            totalMessages: user.totalMessages ?? 0,
            totalVoice: user.totalVoice ?? 0,
            totalCommands: user.totalCommands ?? 0,
        };
    });

    return ok({
        guild: { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 128 }) },
        type,
        maxLevel: config.maxLevel,
        entries,
    });
}

/**
 * Health numbers for the developer panel.
 * @param {Client} client
 */
async function stats(client) {
    return ok({
        shardId: client.shard?.ids[0] ?? 0,
        status: client.ws.status,
        ping: client.ws.ping,
        uptimeMs: client.uptime ?? 0,
        guilds: client.guilds.cache.size,
        members: client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
}

/**
 * Finds a guild on this shard and checks, live, that the user can manage it.
 * Manage Server is the same permission the level settings commands require.
 * @param {Client} client
 * @param {unknown} guildId
 * @param {unknown} userId
 * @returns {Promise<{ ok: true, guild: import('discord.js').Guild, member: import('discord.js').GuildMember } |
 *   { ok: false, status: number, error: string }>}
 */
async function getManagedGuild(client, guildId, userId) {
    if (typeof guildId !== 'string' || !SNOWFLAKE.test(guildId)) return fail(404, 'Server not found');
    if (typeof userId !== 'string' || !SNOWFLAKE.test(userId)) return fail(401, 'Not logged in');

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return fail(404, 'Server not found');

    const member = await guild.members.fetch({ user: userId, force: true }).catch(() => null);
    if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return fail(403, 'You need the Manage Server permission in this server');
    }

    return { ok: true, guild, member };
}

/**
 * The bot's profile in a server, for the Bot Settings page.
 * @param {import('discord.js').Guild} guild
 * @param {import('../shared/models/guildSettings.js').GuildSettingsType} stored - About Me and embed colour
 * @param {import('discord.js').GuildMember} [me] - Defaults to the cached bot member
 */
function botView(guild, stored, me = guild.members.me) {
    return {
        username: guild.client.user.username,
        nickname: me.nickname ?? null,
        avatar: me.displayAvatarURL({ extension: 'png', size: 256 }),
        customAvatar: me.avatar ? me.avatarURL({ size: 256 }) : null,
        defaultAvatar: guild.client.user.displayAvatarURL({ extension: 'png', size: 256 }),
        banner: me.banner ? me.bannerURL({ size: 1024 }) : null,
        bio: stored.bio ?? null,
        embedColour: stored.embedColour ?? null,
        canChangeNickname: me.permissions.has(PermissionFlagsBits.ChangeNickname),
    };
}

/**
 * @param {import('discord.js').GuildBasedChannel} channel
 * @param {import('discord.js').GuildMember} me
 */
function canPostEmbeds(channel, me) {
    return (
        (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) &&
        me.permissionsIn(channel).has(POST_EMBED_PERMISSIONS)
    );
}

/**
 * @param {import('discord.js').Guild} guild
 * @returns {(roleId: string) => boolean}
 */
function roleExists(guild) {
    return (roleId) => guild.roles.cache.has(roleId);
}

/**
 * What the validators need to know about a guild.
 * @param {import('discord.js').Guild} guild
 * @returns {import('./validation.js').GuildContext}
 */
function guildContext(guild) {
    const me = guild.members.me;
    return {
        textChannelIds: new Set(
            guild.channels.cache.filter((channel) => canPostEmbeds(channel, me)).map((channel) => channel.id)
        ),
        channelIds: new Set(guild.channels.cache.filter((channel) => !channel.isThread()).map((channel) => channel.id)),
        roles: new Map(
            guild.roles.cache
                .filter((role) => role.id !== guild.id)
                .map((role) => [role.id, { position: role.position, managed: role.managed }])
        ),
        botHighestRolePosition: me.roles.highest.position,
        emojiIds: new Set(guild.emojis.cache.map((emoji) => emoji.id)),
        categoryIds: new Set(
            guild.channels.cache
                .filter((channel) => channel.type === ChannelType.GuildCategory)
                .map((channel) => channel.id)
        ),
    };
}

/** @param {any} data @returns {Result} */
function ok(data) {
    return { ok: true, data };
}

/**
 * @param {number} status
 * @param {string} error
 * @param {string[]} [details]
 * @returns {{ ok: false, status: number, error: string, details?: string[] }}
 */
function fail(status, error, details) {
    return details ? { ok: false, status, error, details } : { ok: false, status, error };
}
