import {
    ChannelType,
    GuildVerificationLevel,
    PermissionFlagsBits,
    UserFlags,
    version as discordVersion,
} from 'discord.js';

/**
 * Builds the fields for /information. Labels are translation keys under commands.information, so each
 * function returns [labelKey, value, inline] tuples (or null to skip a field).
 *
 * @typedef {[string, string, boolean?] | null | false} Field
 */

/** Discord's timestamp: the date, then "3 years ago". */
export const when = (date) => {
    const seconds = Math.floor(new Date(date).getTime() / 1000);
    return `<t:${seconds}:D> (<t:${seconds}:R>)`;
};

/** Profile badges people can see, in Discord's order. */
/** @type {[UserFlags, string][]} */
const BADGES = [
    [UserFlags.Staff, 'Discord Staff'],
    [UserFlags.Partner, 'Partnered Server Owner'],
    [UserFlags.CertifiedModerator, 'Moderator Programs Alumni'],
    [UserFlags.Hypesquad, 'HypeSquad Events'],
    [UserFlags.HypeSquadOnlineHouse1, 'HypeSquad Bravery'],
    [UserFlags.HypeSquadOnlineHouse2, 'HypeSquad Brilliance'],
    [UserFlags.HypeSquadOnlineHouse3, 'HypeSquad Balance'],
    [UserFlags.BugHunterLevel1, 'Bug Hunter'],
    [UserFlags.BugHunterLevel2, 'Gold Bug Hunter'],
    [UserFlags.ActiveDeveloper, 'Active Developer'],
    [UserFlags.VerifiedDeveloper, 'Early Verified Bot Developer'],
    [UserFlags.PremiumEarlySupporter, 'Early Supporter'],
    [UserFlags.VerifiedBot, 'Verified Bot'],
];

/** Permissions worth pointing out, in the order Discord lists them. */
/** @type {[bigint, string][]} */
const KEY_PERMISSIONS = [
    [PermissionFlagsBits.Administrator, 'Administrator'],
    [PermissionFlagsBits.ManageGuild, 'Manage Server'],
    [PermissionFlagsBits.ManageRoles, 'Manage Roles'],
    [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
    [PermissionFlagsBits.ManageWebhooks, 'Manage Webhooks'],
    [PermissionFlagsBits.ManageGuildExpressions, 'Manage Expressions'],
    [PermissionFlagsBits.ViewAuditLog, 'View Audit Log'],
    [PermissionFlagsBits.BanMembers, 'Ban Members'],
    [PermissionFlagsBits.KickMembers, 'Kick Members'],
    [PermissionFlagsBits.ModerateMembers, 'Timeout Members'],
    [PermissionFlagsBits.ManageMessages, 'Manage Messages'],
    [PermissionFlagsBits.ManageNicknames, 'Manage Nicknames'],
    [PermissionFlagsBits.MentionEveryone, 'Mention @everyone'],
];

/**
 * @param {import('discord.js').PermissionsBitField} permissions
 */
export function keyPermissions(permissions) {
    // Administrator includes everything else, so that's all there is to say
    if (permissions.has(PermissionFlagsBits.Administrator, false)) return ['Administrator'];
    return KEY_PERMISSIONS.filter(([flag]) => permissions.has(flag, false)).map(([, name]) => name);
}

/**
 * Mentions joined up to Discord's 1024-character field limit, with "and N more" for the rest.
 * @param {string[]} items
 */
export function joinLimited(items, max = 1000) {
    const shown = [];
    let length = 0;
    for (const item of items) {
        if (length + item.length + 2 > max - 20) break;
        shown.push(item);
        length += item.length + 2;
    }
    const rest = items.length - shown.length;
    return shown.join(', ') + (rest > 0 ? ` and ${rest} more` : '');
}

/**
 * @param {import('discord.js').User} user - Fetched, so its badges and banner are known
 * @param {import('discord.js').GuildMember | null} member - When they're in this server
 * @returns {Field[]}
 */
export function userFields(user, member) {
    const badges = BADGES.filter(([flag]) => user.flags?.has(flag)).map(([, name]) => name);
    /** @type {Field[]} */
    const fields = [
        ['id', `\`${user.id}\``, true],
        ['type', user.bot ? '🤖 Bot' : '👤 Person', true],
        ['created', when(user.createdAt), false],
        badges.length > 0 && ['badges', badges.join(', '), false],
    ];
    if (!member) return fields;

    const roles = member.roles.cache
        .filter((role) => role.id !== member.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => role.toString());
    const permissions = keyPermissions(member.permissions);
    const timedOutUntil = member.communicationDisabledUntilTimestamp;

    fields.push(
        ['joined', member.joinedAt ? when(member.joinedAt) : '?', false],
        member.nickname && ['nickname', member.nickname, true],
        roles.length > 0 && ['highest_role', member.roles.highest.toString(), true],
        member.premiumSince && ['boosting', when(member.premiumSince), false],
        timedOutUntil && timedOutUntil > Date.now() && ['timed_out', when(timedOutUntil), false],
        ['roles', roles.length > 0 ? `(${roles.length}) ${joinLimited(roles)}` : '-', false],
        member.guild.ownerId === member.id
            ? ['permissions', '👑 Server owner', false]
            : permissions.length > 0 && ['permissions', permissions.join(', '), false]
    );
    return fields;
}

const FEATURE_NAMES = {
    COMMUNITY: 'Community',
    PARTNERED: 'Partnered',
    VERIFIED: 'Verified',
    DISCOVERABLE: 'Discoverable',
    VANITY_URL: 'Vanity URL',
    ANIMATED_ICON: 'Animated icon',
    BANNER: 'Banner',
    ROLE_ICONS: 'Role icons',
    WELCOME_SCREEN_ENABLED: 'Welcome screen',
    MEMBER_VERIFICATION_GATE_ENABLED: 'Membership screening',
    TICKETED_EVENTS_ENABLED: 'Ticketed events',
    MONETIZATION_ENABLED: 'Server subscriptions',
};

const VERIFICATION = {
    [GuildVerificationLevel.None]: 'None',
    [GuildVerificationLevel.Low]: 'Low (verified email)',
    [GuildVerificationLevel.Medium]: 'Medium (registered 5+ minutes)',
    [GuildVerificationLevel.High]: 'High (member 10+ minutes)',
    [GuildVerificationLevel.VeryHigh]: 'Highest (verified phone)',
};

/**
 * @param {import('discord.js').Guild} guild
 * @returns {Field[]}
 */
export function serverFields(guild) {
    const channels = guild.channels.cache;
    const count = (...types) => channels.filter((channel) => types.includes(channel.type)).size;
    const channelSummary = [
        `💬 ${count(ChannelType.GuildText, ChannelType.GuildAnnouncement)} text`,
        `🔊 ${count(ChannelType.GuildVoice, ChannelType.GuildStageVoice)} voice`,
        count(ChannelType.GuildForum, ChannelType.GuildMedia) > 0 &&
            `🗂️ ${count(ChannelType.GuildForum, ChannelType.GuildMedia)} forum`,
        `📁 ${count(ChannelType.GuildCategory)} categories`,
    ].filter(Boolean);
    const features = guild.features.map((feature) => FEATURE_NAMES[feature]).filter(Boolean);

    return [
        ['id', `\`${guild.id}\``, true],
        ['owner', `<@${guild.ownerId}>`, true],
        ['created', when(guild.createdAt), false],
        ['members', guild.memberCount.toLocaleString('en-GB'), true],
        ['roles_count', String(guild.roles.cache.size - 1), true],
        ['emojis', `${guild.emojis.cache.size} emojis, ${guild.stickers.cache.size} stickers`, true],
        ['channels', channelSummary.join('\n'), true],
        ['boosts', `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} boosts)`, true],
        ['verification', VERIFICATION[guild.verificationLevel] ?? 'Unknown', true],
        guild.vanityURLCode && ['vanity', `discord.gg/${guild.vanityURLCode}`, true],
        features.length > 0 && ['features', features.join(', '), false],
    ];
}

/**
 * @param {import('discord.js').Role} role
 * @param {number | null} memberCount - null when Ovx couldn't count them
 * @returns {Field[]}
 */
export function roleFields(role, memberCount) {
    const permissions = keyPermissions(role.permissions);
    const managedBy = role.tags?.botId
        ? `<@${role.tags.botId}>`
        : role.tags?.premiumSubscriberRole
          ? 'Server boosts'
          : role.tags?.integrationId
            ? 'An integration'
            : null;
    return [
        ['id', `\`${role.id}\``, true],
        ['colour', role.color ? role.hexColor : 'None', true],
        ['members', memberCount === null ? '?' : memberCount.toLocaleString('en-GB'), true],
        ['position', `${role.position} of ${role.guild.roles.cache.size - 1}`, true],
        ['shown_separately', role.hoist ? 'Yes' : 'No', true],
        ['mentionable', role.mentionable ? 'Yes' : 'No', true],
        managedBy && ['managed_by', managedBy, true],
        ['created', when(role.createdAt), false],
        ['permissions', permissions.length > 0 ? permissions.join(', ') : 'None of note', false],
    ];
}

const CHANNEL_TYPES = {
    [ChannelType.GuildText]: 'Text',
    [ChannelType.GuildAnnouncement]: 'Announcement',
    [ChannelType.GuildVoice]: 'Voice',
    [ChannelType.GuildStageVoice]: 'Stage',
    [ChannelType.GuildCategory]: 'Category',
    [ChannelType.GuildForum]: 'Forum',
    [ChannelType.GuildMedia]: 'Media',
    [ChannelType.PublicThread]: 'Thread',
    [ChannelType.PrivateThread]: 'Private thread',
    [ChannelType.AnnouncementThread]: 'Announcement thread',
};

/**
 * @param {import('discord.js').GuildBasedChannel} channel
 * @returns {Field[]}
 */
export function channelFields(channel) {
    const any = /** @type {any} */ (channel);
    const slowmode = any.rateLimitPerUser ? `${any.rateLimitPerUser}s` : null;
    return [
        ['id', `\`${channel.id}\``, true],
        ['channel_type', CHANNEL_TYPES[channel.type] ?? 'Other', true],
        channel.parent && ['parent', channel.isThread() ? `${channel.parent}` : channel.parent.name, true],
        ['created', when(channel.createdAt), false],
        any.topic && ['topic', String(any.topic).slice(0, 1000), false],
        slowmode && ['slowmode', slowmode, true],
        'nsfw' in channel && channel.nsfw && ['nsfw', 'Yes', true],
        channel.isVoiceBased() && ['bitrate', `${Math.round(channel.bitrate / 1000)} kbps`, true],
        channel.isVoiceBased() && ['user_limit', channel.userLimit ? String(channel.userLimit) : 'None', true],
        channel.isVoiceBased() && ['connected', String(channel.members.size), true],
        channel.type === ChannelType.GuildCategory && [
            'children',
            String(/** @type {import('discord.js').CategoryChannel} */ (channel).children.cache.size),
            true,
        ],
        channel.isThread() && ['archived', channel.archived ? 'Yes' : 'No', true],
    ];
}

/**
 * @param {{ servers: number, members: number, shards: number, memoryMb: number }} totals
 * @param {import('discord.js').Client} client
 * @param {number} commandCount
 * @returns {Field[]}
 */
export function botFields(totals, client, commandCount) {
    const started = Math.floor((Date.now() - (client.uptime ?? 0)) / 1000);
    return [
        ['servers', totals.servers.toLocaleString('en-GB'), true],
        ['members', totals.members.toLocaleString('en-GB'), true],
        ['commands', String(commandCount), true],
        ['shards', String(totals.shards), true],
        ['ping', `${Math.max(0, Math.round(client.ws.ping))} ms`, true],
        ['memory', `${totals.memoryMb.toLocaleString('en-GB')} MB`, true],
        ['online_since', `<t:${started}:R>`, true],
        ['created', when(client.user.createdAt), true],
        ['versions', `Node.js ${process.version}, discord.js v${discordVersion}`, false],
    ];
}
