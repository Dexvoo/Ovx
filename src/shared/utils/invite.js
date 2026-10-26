import { PermissionsBitField, PermissionFlagsBits, OAuth2Scopes } from 'discord.js';

/** Ovx's support server. The dashboard's front end has its own copy (public/landing.js), which must match. */
export const SUPPORT_URL = 'https://discord.gg/t7tF2Qs3Qc';

// What the bot needs for its features; used in "Add to server" links. Server admins can untick any of them.
// Discord only lets a bot allow or deny a permission in a channel's overrides if it has that permission itself,
// so anything Ovx writes into overrides (tickets, join-to-create, locks, stats channels) must be listed here too.
// Servers that already added Ovx keep their old permissions: they have to grant new ones themselves.
export const BOT_PERMISSIONS = new PermissionsBitField([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageRoles, // Level rewards, auto roles, ticket access
    PermissionFlagsBits.ViewAuditLog, // Who did what, in logs
    PermissionFlagsBits.ManageChannels, // Ticket channels
    PermissionFlagsBits.ManageMessages, // /moderation purge
    PermissionFlagsBits.ManageNicknames, // /moderation nickname
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ModerateMembers, // /moderation mute
    PermissionFlagsBits.ChangeNickname, // Bot Settings nickname
    PermissionFlagsBits.ManageGuildExpressions, // /emoji and /sticker
    PermissionFlagsBits.ManageGuild, // AutoMod rules, and pausing invites during a raid
    PermissionFlagsBits.MoveMembers, // Join-to-create voice channels
    PermissionFlagsBits.Connect, // Join-to-create voice channels
    PermissionFlagsBits.Speak, // Join-to-create: given to a channel's owner
    PermissionFlagsBits.Stream, // Join-to-create: given to a channel's owner
    PermissionFlagsBits.UseVAD, // Join-to-create: given to a channel's owner
    PermissionFlagsBits.CreatePublicThreads, // Suggestion discussion threads; turned off by /moderation lock
    PermissionFlagsBits.CreatePrivateThreads, // Turned off by /moderation lock
    PermissionFlagsBits.SendMessagesInThreads, // Turned off by /moderation lock
    PermissionFlagsBits.MentionEveryone, // Stream alerts that ping @everyone, and pinging roles that aren't mentionable
]).bitfield.toString();

/**
 * The "Add to server" link. Without a guildId, Discord asks which server to add the bot to.
 * @param {string} applicationId
 * @param {string} [guildId]
 */
export function inviteUrl(applicationId, guildId) {
    const params = new URLSearchParams({
        client_id: applicationId,
        scope: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands].join(' '),
        permissions: BOT_PERMISSIONS,
        ...(guildId && { guild_id: guildId, disable_guild_select: 'true' }),
    });
    return `https://discord.com/oauth2/authorize?${params}`;
}

/**
 * The link to add Ovx to your own Discord account (a user install), so its user commands work in any DM or server.
 * @param {string} applicationId
 */
export function userInstallUrl(applicationId) {
    const params = new URLSearchParams({
        client_id: applicationId,
        integration_type: '1',
        scope: OAuth2Scopes.ApplicationsCommands,
    });
    return `https://discord.com/oauth2/authorize?${params}`;
}
