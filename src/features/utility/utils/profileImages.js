import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';

const CDN = 'https://cdn.discordapp.com';
const SIZE = 4096;

/**
 * Links to an image in each format Discord serves it in, at full size.
 * @param {string} url - Any size or format of the image
 * @param {boolean} animated
 * @returns {{ label: string, url: string }[]}
 */
export function formatLinks(url, animated) {
    const base = url.split('?')[0].replace(/\.(png|jpe?g|webp|gif)$/, '');
    // Discord's default avatars only come as PNG, in one size
    if (base.includes('/embed/avatars/')) return [{ label: 'PNG', url: `${base}.png` }];
    const formats = animated ? ['gif', 'png', 'webp'] : ['png', 'jpg', 'webp'];
    return formats.map((format) => ({ label: format.toUpperCase(), url: `${base}.${format}?size=${SIZE}` }));
}

/**
 * The member's server avatar or banner hash, whether Ovx is in the server (a GuildMember)
 * or it's a user-installed command in a server Ovx isn't in (Discord's raw member data).
 * @param {any} member
 * @param {'avatar' | 'banner'} kind
 * @returns {string | null}
 */
export function memberImageHash(member, kind) {
    if (!member) return null;
    return member[kind] ?? null;
}

/**
 * @param {string} guildId
 * @param {string} userId
 * @param {string} hash
 * @param {'avatar' | 'banner'} kind
 */
export function memberImageUrl(guildId, userId, hash, kind) {
    const folder = kind === 'avatar' ? 'avatars' : 'banners';
    return `${CDN}/guilds/${guildId}/users/${userId}/${folder}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=${SIZE}`;
}

/**
 * An embed showing one image, with buttons to open it in each format.
 * @param {{ title: string, url: string, guildId: string | null }} options
 */
export async function imageReply({ title, url, guildId }) {
    const animated = /\/a_[^/]+\.\w+/.test(url);
    const links = formatLinks(url, animated);
    const embed = new EmbedBuilder()
        .setColor(await brandColour(guildId))
        .setTitle(title)
        .setURL(links[0].url)
        .setImage(links[0].url);
    const row = /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
        links.map((link) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(link.label).setURL(link.url))
    );
    return { embed, row };
}
