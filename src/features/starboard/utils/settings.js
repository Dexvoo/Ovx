import { parseButtonEmoji } from '../../../dashboard/validation.js';

/**
 * The dashboard side of the starboard: what the page sees, checking a save, and describing it for the Web Logs.
 */

export const STARBOARD_LIMITS = Object.freeze({ THRESHOLD_MAX: 100, IGNORED_CHANNELS_MAX: 50 });
const TOGGLES = ['enabled', 'selfStar', 'allowBots', 'removeBelow'];

/**
 * @param {import('../models/starboard.js').StarboardConfigType} config
 */
export function starboardView(config) {
    return {
        enabled: config.enabled,
        channelId: config.channelId ?? null,
        emoji: config.emoji,
        threshold: config.threshold,
        selfStar: config.selfStar,
        allowBots: config.allowBots,
        removeBelow: config.removeBelow,
        ignoredChannelIds: [...config.ignoredChannelIds],
    };
}

/**
 * @param {unknown} input
 * @param {import('../../../dashboard/validation.js').GuildContext} guild
 */
export function validateStarboardSettings(input, guild) {
    const errors = [];
    const data = input && typeof input === 'object' ? /** @type {any} */ (input) : {};
    /** @type {Record<string, unknown>} */
    const settings = {};

    for (const key of TOGGLES) {
        if (typeof data[key] !== 'boolean') errors.push(`${key} must be on or off`);
        else settings[key] = data[key];
    }

    const channelId = data.channelId || null;
    if (channelId !== null && !guild.textChannelIds.has(channelId))
        errors.push('Choose a text channel Ovx can post in.');
    else settings.channelId = channelId;
    if (data.enabled === true && !channelId) errors.push('Choose a starboard channel before turning it on.');

    const emoji = parseButtonEmoji(data.emoji || '⭐', guild.emojiIds);
    if (!emoji.ok || !emoji.emoji) errors.push("The emoji must be a single emoji, or one of this server's emojis.");
    else settings.emoji = emoji.emoji;

    const threshold = Number(data.threshold);
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > STARBOARD_LIMITS.THRESHOLD_MAX) {
        errors.push(`The stars needed must be between 1 and ${STARBOARD_LIMITS.THRESHOLD_MAX}.`);
    } else settings.threshold = threshold;

    const ignored = data.ignoredChannelIds;
    if (!Array.isArray(ignored) || ignored.some((id) => typeof id !== 'string'))
        errors.push('Ignored channels must be a list');
    else {
        const unique = [...new Set(ignored)];
        if (unique.length > STARBOARD_LIMITS.IGNORED_CHANNELS_MAX) {
            errors.push(`Choose at most ${STARBOARD_LIMITS.IGNORED_CHANNELS_MAX} ignored channels`);
        } else if (unique.some((id) => !guild.channelIds.has(id)))
            errors.push('One of the ignored channels no longer exists');
        else settings.ignoredChannelIds = unique;
    }

    return { settings: errors.length ? null : settings, errors };
}

/**
 * @param {ReturnType<typeof starboardView>} before
 * @param {ReturnType<typeof starboardView>} after
 * @param {{ channel: (id: string) => string }} names
 */
export function describeStarboardChanges(before, after, names) {
    const onOff = (value) => (value ? 'on' : 'off');
    const labels = {
        enabled: 'Starboard',
        selfStar: 'Authors can star their own messages',
        allowBots: "Bots' messages can be starred",
        removeBelow: 'Remove when stars drop below the threshold',
    };
    const changes = TOGGLES.filter((key) => before[key] !== after[key]).map(
        (key) => `${labels[key]}: ${onOff(before[key])} → ${onOff(after[key])}`
    );
    if (before.channelId !== after.channelId) {
        changes.push(`Channel: ${names.channel(before.channelId)} → ${names.channel(after.channelId)}`);
    }
    if (before.emoji !== after.emoji) changes.push(`Emoji: ${before.emoji} → ${after.emoji}`);
    if (before.threshold !== after.threshold) changes.push(`Stars needed: ${before.threshold} → ${after.threshold}`);
    for (const id of after.ignoredChannelIds.filter((item) => !before.ignoredChannelIds.includes(item))) {
        changes.push(`Added ignored channel: ${names.channel(id)}`);
    }
    for (const id of before.ignoredChannelIds.filter((item) => !after.ignoredChannelIds.includes(item))) {
        changes.push(`Removed ignored channel: ${names.channel(id)}`);
    }
    return changes;
}
