import { cleanText, parseButtonEmoji } from '../../../dashboard/validation.js';

/** Discord's limits for a message and its embed, plus how many messages a server can keep. */
export const CUSTOM_EMBED_LIMITS = Object.freeze({
    MESSAGES_MAX: 50,
    NAME_MAX: 100,
    CONTENT_MAX: 2000,
    TITLE_MAX: 256,
    DESCRIPTION_MAX: 4096,
    FIELDS_MAX: 25,
    FIELD_NAME_MAX: 256,
    FIELD_VALUE_MAX: 1024,
    AUTHOR_MAX: 256,
    FOOTER_MAX: 2048,
    EMBED_TOTAL_MAX: 6000,
    BUTTONS_MAX: 5,
    BUTTON_LABEL_MAX: 80,
    URL_MAX: 2048,
});

const HEX_COLOUR = /^#[\da-f]{6}$/i;

/**
 * A web link, or null when empty. Images must be http(s) so Discord can load them.
 * @param {unknown} value
 * @param {string} label
 * @param {string[]} errors
 */
function cleanUrl(value, label, errors) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string' || value.length > CUSTOM_EMBED_LIMITS.URL_MAX) {
        errors.push(`${label} must be a link`);
        return null;
    }
    try {
        const url = new URL(value.trim());
        if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    } catch {
        // Falls through to the error
    }
    errors.push(`${label} must be a link starting with https://`);
    return null;
}

/** Characters, counted the way Discord counts them for its 6000 total. */
const length = (text) => (text ? [...text].length : 0);

/**
 * Checks a custom message from the dashboard.
 * @param {unknown} input
 * @param {import('../../../dashboard/validation.js').GuildContext} guild
 */
export function validateCustomMessage(input, guild) {
    /** @type {string[]} */
    const errors = [];
    const data = input && typeof input === 'object' ? /** @type {any} */ (input) : {};
    const raw = data.embed && typeof data.embed === 'object' ? data.embed : {};
    const L = CUSTOM_EMBED_LIMITS;
    const text = (value, label, max, multiline = false) =>
        cleanText(value ?? null, label, max, { multiline }, errors) ?? null;

    const name = text(data.name, 'The name', L.NAME_MAX);
    if (!name) errors.push('Give it a name, so you can find it on this page.');
    if (!guild.textChannelIds.has(data.channelId)) errors.push('Choose a text channel Ovx can post in.');
    const content = text(data.content, 'The message text', L.CONTENT_MAX, true);

    const colour = raw.colour === null || raw.colour === '' || raw.colour === undefined ? null : raw.colour;
    if (colour !== null && !(typeof colour === 'string' && HEX_COLOUR.test(colour))) {
        errors.push('The colour must be a hex colour like #b69cff.');
    }

    const rawFields = Array.isArray(raw.fields) ? raw.fields : [];
    if (rawFields.length > L.FIELDS_MAX) errors.push(`An embed can have at most ${L.FIELDS_MAX} fields.`);
    const fields = rawFields.slice(0, L.FIELDS_MAX).map((field, index) => {
        const item = field && typeof field === 'object' ? field : {};
        const fieldName = text(item.name, `Field ${index + 1}'s name`, L.FIELD_NAME_MAX);
        const value = text(item.value, `Field ${index + 1}'s text`, L.FIELD_VALUE_MAX, true);
        if (!fieldName || !value) errors.push(`Field ${index + 1} needs a name and some text.`);
        return { name: fieldName ?? '', value: value ?? '', inline: item.inline === true };
    });

    const embed = {
        title: text(raw.title, 'The title', L.TITLE_MAX),
        url: cleanUrl(raw.url, 'The title link', errors),
        description: text(raw.description, 'The description', L.DESCRIPTION_MAX, true),
        colour: colour ? colour.toLowerCase() : null,
        author: {
            name: text(raw.author?.name, 'The author', L.AUTHOR_MAX),
            iconUrl: cleanUrl(raw.author?.iconUrl, 'The author icon', errors),
            url: cleanUrl(raw.author?.url, 'The author link', errors),
        },
        fields,
        thumbnailUrl: cleanUrl(raw.thumbnailUrl, 'The thumbnail', errors),
        imageUrl: cleanUrl(raw.imageUrl, 'The image', errors),
        footer: {
            text: text(raw.footer?.text, 'The footer', L.FOOTER_MAX, true),
            iconUrl: cleanUrl(raw.footer?.iconUrl, 'The footer icon', errors),
        },
        timestamp: raw.timestamp === true,
    };

    const total =
        length(embed.title) +
        length(embed.description) +
        length(embed.author.name) +
        length(embed.footer.text) +
        fields.reduce((sum, field) => sum + length(field.name) + length(field.value), 0);
    if (total > L.EMBED_TOTAL_MAX) {
        errors.push(`All the embed's text together can be at most ${L.EMBED_TOTAL_MAX} characters (it's ${total}).`);
    }

    const rawButtons = Array.isArray(data.buttons) ? data.buttons : [];
    if (rawButtons.length > L.BUTTONS_MAX) errors.push(`A message can have at most ${L.BUTTONS_MAX} link buttons.`);
    const buttons = rawButtons.slice(0, L.BUTTONS_MAX).map((button, index) => {
        const item = button && typeof button === 'object' ? button : {};
        const label = text(item.label, `Button ${index + 1}'s label`, L.BUTTON_LABEL_MAX);
        const url = cleanUrl(item.url, `Button ${index + 1}'s link`, errors);
        const emoji = parseButtonEmoji(item.emoji ?? null, guild.emojiIds);
        if (!emoji.ok)
            errors.push(`Button ${index + 1}: the emoji must be a single emoji, or one of this server's emojis.`);
        if (!label && !(emoji.ok && emoji.emoji)) errors.push(`Button ${index + 1} needs a label or an emoji.`);
        if (!url) errors.push(`Button ${index + 1} needs a link.`);
        return { label: label ?? '', url: url ?? '', emoji: emoji.ok ? emoji.emoji : null };
    });

    if (!content && !hasEmbed(embed)) errors.push('Add some message text or fill in the embed.');

    if (errors.length > 0) return { message: null, errors };
    return {
        message: {
            name: /** @type {string} */ (name),
            channelId: /** @type {string} */ (data.channelId),
            content,
            embed,
            buttons,
            allowPings: data.allowPings === true,
        },
        errors,
    };
}

/**
 * Whether an embed has anything to show (Discord refuses an empty one).
 * @param {import('../models/customMessage.js').CustomEmbedType | undefined} embed
 */
export function hasEmbed(embed) {
    return Boolean(
        embed &&
        (embed.title ||
            embed.description ||
            embed.author?.name ||
            embed.footer?.text ||
            embed.imageUrl ||
            embed.thumbnailUrl ||
            embed.fields?.length)
    );
}
