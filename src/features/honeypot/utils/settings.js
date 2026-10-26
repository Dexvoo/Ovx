/**
 * The dashboard side of the honeypot channel: what the page sees, checking a save, and describing it for the Web Logs.
 */
import { HONEYPOT_ACTIONS, HONEYPOT_DELETE_SECONDS } from '../models/honeypotConfig.js';

export const HONEYPOT_LIMITS = Object.freeze({ ACTIONS: HONEYPOT_ACTIONS, DELETE_SECONDS: HONEYPOT_DELETE_SECONDS });
const TOGGLES = ['enabled', 'notify'];

/**
 * @param {import('../models/honeypotConfig.js').HoneypotConfigType} config
 */
export function honeypotView(config) {
    return {
        enabled: config.enabled,
        channelId: config.channelId,
        action: config.action,
        deleteMessageSeconds: config.deleteMessageSeconds,
        notify: config.notify,
    };
}

/**
 * @param {unknown} input
 * @param {import('../../../dashboard/validation.js').GuildContext} guild
 */
export function validateHoneypotSettings(input, guild) {
    const errors = [];
    const data = input && typeof input === 'object' ? /** @type {any} */ (input) : {};
    /** @type {Record<string, unknown>} */
    const settings = {};

    for (const key of TOGGLES) {
        if (typeof data[key] !== 'boolean') errors.push(`${key} must be on or off`);
        else settings[key] = data[key];
    }

    const channelId = data.channelId || null;
    if (channelId !== null && (typeof channelId !== 'string' || !guild.channelIds.has(channelId)))
        errors.push('That channel no longer exists');
    else settings.channelId = channelId;
    if (data.enabled === true && !channelId) errors.push('Choose a honeypot channel before turning it on.');

    if (!HONEYPOT_ACTIONS.includes(data.action)) errors.push('Choose ban or softban');
    else settings.action = data.action;

    if (!HONEYPOT_DELETE_SECONDS.includes(data.deleteMessageSeconds)) errors.push('Choose how many messages to delete');
    else settings.deleteMessageSeconds = data.deleteMessageSeconds;

    return { settings: errors.length ? null : settings, errors };
}

/** e.g. 3600 → "1 hour", 0 → "none" */
function deleteLabel(seconds) {
    if (!seconds) return 'none';
    const hours = seconds / 3600;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
    const days = hours / 24;
    return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * @param {ReturnType<typeof honeypotView>} before
 * @param {ReturnType<typeof honeypotView>} after
 * @param {{ channel: (id: string) => string }} names
 */
export function describeHoneypotChanges(before, after, names) {
    const onOff = (value) => (value ? 'on' : 'off');
    const changes = [];
    if (before.enabled !== after.enabled) changes.push(`Honeypot: ${onOff(before.enabled)} → ${onOff(after.enabled)}`);
    if (before.channelId !== after.channelId)
        changes.push(`Channel: ${names.channel(before.channelId)} → ${names.channel(after.channelId)}`);
    if (before.action !== after.action) changes.push(`Action: ${before.action} → ${after.action}`);
    if (before.deleteMessageSeconds !== after.deleteMessageSeconds)
        changes.push(
            `Delete their messages from the last: ${deleteLabel(before.deleteMessageSeconds)} → ${deleteLabel(after.deleteMessageSeconds)}`
        );
    if (before.notify !== after.notify)
        changes.push(`Tell the member why: ${onOff(before.notify)} → ${onOff(after.notify)}`);
    return changes;
}
