import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown } from 'discord.js';

/**
 * @typedef {Object} StreamAccount
 * @property {string} id
 * @property {string} name
 * @property {string} displayName
 * @property {string | null} avatar
 * @property {string} url
 *
 * @typedef {Object} LiveStream
 * @property {string} id - Changes with every stream, so each one is announced once
 * @property {string} title
 * @property {string | null} game
 * @property {number | null} viewers
 * @property {Date | null} startedAt
 * @property {string | null} thumbnail
 * @property {string} url
 *
 * @typedef {Object} Video
 * @property {string} id
 * @property {string} title
 * @property {string} url
 * @property {string | null} thumbnail
 * @property {Date | null} publishedAt
 */

export const PLATFORMS = Object.freeze({
    twitch: { name: 'Twitch', colour: 0x9146ff, watch: 'Watch on Twitch' },
    youtube: { name: 'YouTube', colour: 0xff0033, watch: 'Watch on YouTube' },
    kick: { name: 'Kick', colour: 0x53fc18, watch: 'Watch on Kick' },
});

/** Used when a server hasn't written its own message. */
export const STREAM_DEFAULTS = Object.freeze({
    liveMessage: '**{streamer}** is live on {platform}!',
    videoMessage: '**{streamer}** posted a new video!',
});

/** Placeholders people can use in stream messages. */
export const STREAM_PLACEHOLDERS = Object.freeze(['{streamer}', '{title}', '{game}', '{platform}', '{url}']);

/**
 * Fills in the placeholders. Names and titles are escaped, so they can't add formatting or mentions.
 * @param {string} template
 * @param {{ streamer: string, title: string, game: string | null, platform: string, url: string }} values
 */
export function fillStreamPlaceholders(template, values) {
    const replacements = {
        '{streamer}': escapeMarkdown(values.streamer),
        '{title}': escapeMarkdown(values.title),
        '{game}': escapeMarkdown(values.game ?? 'Unknown'),
        '{platform}': values.platform,
        '{url}': values.url,
    };
    // One pass, so a title containing "{url}" is never replaced again
    return template.replace(/\{(streamer|title|game|platform|url)\}/g, (match) => replacements[match]);
}

/**
 * The message posted when a streamer goes live or posts a video.
 * Only the chosen role (or @everyone, if chosen) is pinged; mentions written into the message don't ping.
 *
 * @param {'live' | 'video'} kind
 * @param {import('../models/streamSubscription.js').StreamSubscriptionType} subscription
 * @param {LiveStream | Video} content
 * @returns {import('discord.js').MessageCreateOptions}
 */
export function buildNotification(kind, subscription, content) {
    const platform = PLATFORMS[subscription.platform];
    const live = kind === 'live' ? /** @type {LiveStream} */ (content) : null;

    const template =
        (kind === 'live' ? subscription.liveMessage : subscription.videoMessage) ??
        (kind === 'live' ? STREAM_DEFAULTS.liveMessage : STREAM_DEFAULTS.videoMessage);
    const text = fillStreamPlaceholders(template, {
        streamer: subscription.displayName,
        title: content.title,
        game: live?.game ?? null,
        platform: platform.name,
        url: content.url,
    });

    const ping =
        subscription.roleId === 'everyone' ? '@everyone' : subscription.roleId ? `<@&${subscription.roleId}>` : '';
    const allowedMentions =
        subscription.roleId === 'everyone'
            ? { parse: /** @type {const} */ (['everyone']) }
            : { parse: [], roles: subscription.roleId ? [subscription.roleId] : [] };

    const embed = new EmbedBuilder()
        .setColor(platform.colour)
        .setAuthor({ name: subscription.displayName, iconURL: subscription.avatar ?? undefined, url: subscription.url })
        .setTitle(content.title.slice(0, 256))
        .setURL(content.url)
        .setFooter({ text: platform.name });
    if (content.thumbnail) embed.setImage(content.thumbnail);
    if (live?.game) embed.addFields({ name: 'Playing', value: live.game.slice(0, 1024), inline: true });
    if (live?.viewers !== null && live?.viewers !== undefined) {
        embed.addFields({ name: 'Viewers', value: live.viewers.toLocaleString('en-US'), inline: true });
    }
    const time = live?.startedAt ?? /** @type {Video} */ (content).publishedAt ?? null;
    if (time) embed.setTimestamp(time);

    const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(content.url).setLabel(platform.watch);

    return {
        content: [ping, text].filter(Boolean).join(' ').slice(0, 2000),
        embeds: [embed],
        components: [/** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(button)],
        allowedMentions,
    };
}
