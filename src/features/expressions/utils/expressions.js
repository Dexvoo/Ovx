import { GuildPremiumTier, DiscordAPIError, StickerFormatType } from 'discord.js';

/** Emoji slots per boost level, for static and animated emojis separately. */
export const EMOJI_SLOTS = Object.freeze({
    [GuildPremiumTier.None]: 50,
    [GuildPremiumTier.Tier1]: 100,
    [GuildPremiumTier.Tier2]: 150,
    [GuildPremiumTier.Tier3]: 250,
});

/** Sticker slots per boost level. */
export const STICKER_SLOTS = Object.freeze({
    [GuildPremiumTier.None]: 5,
    [GuildPremiumTier.Tier1]: 15,
    [GuildPremiumTier.Tier2]: 30,
    [GuildPremiumTier.Tier3]: 60,
});

/** Most emojis taken in one command. */
export const TAKE_MAX = 10;
export const EMOJI_FILE_MAX_BYTES = 256 * 1024;
export const STICKER_FILE_MAX_BYTES = 512 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/**
 * Custom emojis pasted into a message: `<:name:id>` or `<a:name:id>`. Duplicates are dropped.
 * @param {string} text
 * @returns {{ id: string, name: string, animated: boolean }[]}
 */
export function parseCustomEmojis(text) {
    const found = new Map();
    for (const [, animated, name, id] of text.matchAll(/<(a?):(\w{2,32}):(\d{17,20})>/g)) {
        if (!found.has(id)) found.set(id, { id, name, animated: animated === 'a' });
    }
    return [...found.values()];
}

/**
 * The image of a custom emoji, small enough for Discord's 256 KB limit.
 * @param {{ id: string, animated: boolean }} emoji
 */
export function emojiImageUrl({ id, animated }) {
    return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=128&quality=lossless`;
}

/**
 * A name Discord accepts: 2–32 letters, numbers and underscores.
 * @param {string} name
 * @param {number} [max=32]
 */
export function cleanName(name, max = 32) {
    const cleaned = name
        .trim()
        .replace(/[^\w]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, max);
    // Too short (or nothing usable, like a name of only symbols): pad it so Discord accepts it
    return cleaned.length >= 2 ? cleaned : `${cleaned}_emoji`.replace(/^_/, '').slice(0, max);
}

/**
 * Free emoji slots, for static and animated emojis.
 * @param {import('discord.js').Guild} guild
 */
export function freeEmojiSlots(guild) {
    const limit = EMOJI_SLOTS[guild.premiumTier] ?? EMOJI_SLOTS[GuildPremiumTier.None];
    const animated = guild.emojis.cache.filter((emoji) => emoji.animated).size;
    const fixed = guild.emojis.cache.size - animated;
    return { limit, static: Math.max(0, limit - fixed), animated: Math.max(0, limit - animated) };
}

/**
 * @param {import('discord.js').Guild} guild
 */
export function freeStickerSlots(guild) {
    const limit = STICKER_SLOTS[guild.premiumTier] ?? STICKER_SLOTS[GuildPremiumTier.None];
    return { limit, free: Math.max(0, limit - guild.stickers.cache.size) };
}

/**
 * Why an uploaded image can't be used, as a translation key, or null if it's fine.
 * @param {import('discord.js').Attachment} attachment
 * @param {number} maxBytes
 */
export function attachmentProblem(attachment, maxBytes) {
    if (!IMAGE_TYPES.has(attachment.contentType?.split(';')[0] ?? '')) return 'not_image';
    if (attachment.size > maxBytes) return 'too_big';
    return null;
}

/** Sticker formats a server can upload (Lottie stickers are Discord's own). */
export function canCopySticker(format) {
    return format !== StickerFormatType.Lottie;
}

/** Discord error codes → translation keys under commands.expressions.errors */
const API_ERRORS = {
    30008: 'emoji_slots',
    30039: 'sticker_slots',
    50045: 'too_big',
    50046: 'not_image',
    50138: 'too_big',
    50013: 'missing_permissions',
    10014: 'unknown_emoji',
    10060: 'unknown_sticker',
};

/**
 * Turns a Discord error into a translation key the user can act on, or null for anything unexpected.
 * @param {unknown} error
 */
export function apiErrorKey(error) {
    if (error instanceof DiscordAPIError) {
        if (Object.hasOwn(API_ERRORS, error.code)) return API_ERRORS[error.code];
        if (error.code === 50035) return 'invalid';
    }
    return null;
}
