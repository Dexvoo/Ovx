import { EmbedBuilder, escapeMarkdown } from 'discord.js';

/** Used when a server hasn't written its own message. */
export const DEFAULT_MESSAGES = Object.freeze({
    welcome: 'Welcome to **{server}**, {user}! You are member #{memberCount}.',
    goodbye: '**{username}** has left the server. We now have {memberCount} members.',
});

/**
 * Placeholders people can use in welcome and goodbye messages.
 * Names are escaped, so a username like `__init__` doesn't turn into formatting.
 */
export const PLACEHOLDERS = Object.freeze({
    '{user}': 'Mentions the member (welcome only pings them)',
    '{username}': 'Their username',
    '{displayName}': 'Their display name',
    '{server}': 'The server name',
    '{memberCount}': 'How many members the server has now',
});

/**
 * Fills in the placeholders for a member. Unknown placeholders are left as they are.
 * @param {string} template
 * @param {{ id: string, username: string, displayName: string, serverName: string, memberCount: number }} values
 */
export function fillPlaceholders(template, values) {
    const replacements = {
        '{user}': `<@${values.id}>`,
        '{username}': escapeMarkdown(values.username),
        '{displayName}': escapeMarkdown(values.displayName),
        '{server}': escapeMarkdown(values.serverName),
        '{memberCount}': values.memberCount.toLocaleString('en-US'),
    };
    // One pass, so text inserted for one placeholder (e.g. a name containing "{server}") is never replaced again
    return template.replace(/\{(user|username|displayName|server|memberCount)\}/g, (match) => replacements[match]);
}

/**
 * Builds the message to send for a member joining or leaving.
 *
 * Only the joining member can ever be pinged: mentions of @everyone, roles or other users written into the
 * message are shown but don't notify anyone, so the feature can't be used for mass pings.
 *
 * @param {'welcome' | 'goodbye'} kind
 * @param {import('../models/welcome.js').WelcomeMessageType} settings
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} member
 * @param {import('discord.js').ColorResolvable} colour - The server's embed colour
 * @returns {import('discord.js').MessageCreateOptions}
 */
export function buildMessage(kind, settings, member, colour) {
    const values = {
        id: member.id,
        username: member.user.username,
        displayName: member.displayName ?? member.user.displayName,
        serverName: member.guild.name,
        memberCount: member.guild.memberCount,
    };
    const text = fillPlaceholders(settings.message ?? DEFAULT_MESSAGES[kind], values);
    // Someone who left can't be pinged in a useful way, so goodbyes never ping
    const allowedMentions = { parse: [], users: kind === 'welcome' ? [member.id] : [] };

    // Placeholders can make the text longer than the template, so it's cut to Discord's limits
    if (!settings.embed) return { content: limit(text, 2000), allowedMentions };

    const embed = new EmbedBuilder()
        .setColor(colour)
        .setDescription(limit(text, 4096))
        .setThumbnail(member.displayAvatarURL({ extension: 'png', size: 256 }));
    if (settings.title) embed.setTitle(limit(fillPlaceholders(settings.title, values), 256));

    // Mentions inside embeds never ping, so the member is mentioned above it to get the notification
    return {
        content: kind === 'welcome' ? `<@${member.id}>` : undefined,
        embeds: [embed],
        allowedMentions,
    };
}

/**
 * @param {string} text
 * @param {number} max
 */
function limit(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
