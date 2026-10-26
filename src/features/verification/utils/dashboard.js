import Verification_Config_Cache from '../cache/verificationConfig.cache.js';
import { VERIFY_METHODS } from '../models/verification.js';
import { verifyPanel } from './verify.js';
import { cleanText } from '../../../dashboard/validation.js';
import { publishMessage } from '../../../shared/utils/postedMessage.js';

export const VERIFICATION_LIMITS = Object.freeze({
    ACCOUNT_DAYS_MAX: 365,
    KICK_HOURS_MAX: 720,
    TITLE_MAX: 256,
    DESCRIPTION_MAX: 2000,
    BUTTON_MAX: 80,
});

/**
 * The dashboard's Verification page, run on the shard after the Manage Server check (see dashboard/shardHandlers.js).
 * @typedef {{ ok: true, data: any, changes?: string[], action?: string } | { ok: false, status: number, error: string, details?: string[] }} Result
 */

/** @param {import('../models/verification.js').VerificationConfigType} config */
export function verificationView(config) {
    return {
        enabled: config.enabled,
        channelId: config.channelId ?? null,
        posted: Boolean(config.messageId),
        roleId: config.roleId ?? null,
        unverifiedRoleId: config.unverifiedRoleId ?? null,
        method: config.method,
        minAccountDays: config.minAccountDays,
        kickAfterHours: config.kickAfterHours,
        title: config.title,
        description: config.description,
        buttonLabel: config.buttonLabel,
    };
}

/**
 * @param {unknown} input
 * @param {import('../../../dashboard/validation.js').GuildContext} guild
 */
export function validateVerificationSettings(input, guild) {
    const errors = [];
    const data = input && typeof input === 'object' ? /** @type {any} */ (input) : {};
    const L = VERIFICATION_LIMITS;
    if (typeof data.enabled !== 'boolean') errors.push('enabled must be on or off');

    const channelId = data.channelId || null;
    if (channelId && !guild.textChannelIds.has(channelId)) errors.push('Choose a text channel Ovx can post in.');

    const givable = (id, label) => {
        if (!id) return null;
        const role = guild.roles.get(id);
        if (!role) errors.push(`${label} no longer exists.`);
        else if (role.managed) errors.push(`${label} is managed by an integration, so it can't be given out.`);
        else if (role.position >= guild.botHighestRolePosition)
            errors.push(`${label} is above Ovx's highest role. Move Ovx's role higher.`);
        return id;
    };
    const roleId = givable(data.roleId || null, 'The verified role');
    const unverifiedRoleId = givable(data.unverifiedRoleId || null, 'The unverified role');
    if (roleId && roleId === unverifiedRoleId) errors.push('The verified and unverified roles must be different.');
    if (data.enabled === true && (!channelId || !roleId))
        errors.push('Choose a channel and a verified role before turning it on.');

    const method = VERIFY_METHODS.includes(data.method) ? data.method : null;
    if (!method) errors.push('Choose how members verify.');
    const int = (value, max, label) => {
        const number = Number(value ?? 0);
        if (!Number.isInteger(number) || number < 0 || number > max) errors.push(`${label} must be from 0 to ${max}.`);
        return number;
    };
    const minAccountDays = int(data.minAccountDays, L.ACCOUNT_DAYS_MAX, 'The minimum account age');
    const kickAfterHours = int(data.kickAfterHours, L.KICK_HOURS_MAX, 'The hours before removing');

    const title = cleanText(data.title ?? null, 'The title', L.TITLE_MAX, { multiline: false }, errors);
    const description = cleanText(data.description ?? null, 'The text', L.DESCRIPTION_MAX, { multiline: true }, errors);
    const buttonLabel = cleanText(data.buttonLabel ?? null, 'The button', L.BUTTON_MAX, { multiline: false }, errors);
    if (!title || !description || !buttonLabel) errors.push('The panel needs a title, text and a button label.');

    if (errors.length) return { settings: null, errors };
    return {
        settings: {
            enabled: data.enabled,
            channelId,
            roleId,
            unverifiedRoleId,
            method,
            minAccountDays,
            kickAfterHours,
            title,
            description,
            buttonLabel,
        },
        errors,
    };
}

/**
 * Saves the settings and posts (or updates) the panel when verification is on.
 * @param {import('discord.js').Guild} guild
 * @param {{ settings?: unknown }} payload
 * @param {import('../../../dashboard/validation.js').GuildContext} context
 * @param {{ channel: (id: string) => string, role: (id: string) => string }} names
 * @returns {Promise<Result>}
 */
export async function verificationDashboard(guild, payload, context, names) {
    const { settings, errors } = validateVerificationSettings(payload.settings, context);
    if (!settings) return { ok: false, status: 400, error: 'Some settings are not valid', details: errors };

    const current = await Verification_Config_Cache.get(guild.id);
    const before = verificationView(current);
    let saved = await Verification_Config_Cache.set(guild.id, settings);

    let warning = null;
    if (saved.enabled && saved.channelId) {
        const published = await publishMessage(guild, {
            channelId: saved.channelId,
            previous: current.channelId ? { channelId: current.channelId, messageId: current.messageId } : null,
            message: await verifyPanel(guild, saved),
            label: 'Verification',
        });
        if (published.ok && published.messageId !== saved.messageId) {
            saved = await Verification_Config_Cache.set(guild.id, { messageId: published.messageId });
        }
        if (!published.ok) warning = published.error;
    }

    const after = verificationView(saved);
    const onOff = (value) => (value ? 'on' : 'off');
    const role = (id) => (id ? names.role(id) : 'none');
    const changes = [
        before.enabled !== after.enabled && `Verification: ${onOff(before.enabled)} → ${onOff(after.enabled)}`,
        before.channelId !== after.channelId &&
            `Channel: ${names.channel(before.channelId)} → ${names.channel(after.channelId)}`,
        before.roleId !== after.roleId && `Verified role: ${role(before.roleId)} → ${role(after.roleId)}`,
        before.unverifiedRoleId !== after.unverifiedRoleId &&
            `Unverified role: ${role(before.unverifiedRoleId)} → ${role(after.unverifiedRoleId)}`,
        before.method !== after.method && `Method: ${before.method} → ${after.method}`,
        before.minAccountDays !== after.minAccountDays &&
            `Minimum account age: ${before.minAccountDays} → ${after.minAccountDays} days`,
        before.kickAfterHours !== after.kickAfterHours &&
            `Remove unverified after: ${before.kickAfterHours} → ${after.kickAfterHours} hours`,
        (before.title !== after.title ||
            before.description !== after.description ||
            before.buttonLabel !== after.buttonLabel) &&
            'Panel text changed',
    ].filter(Boolean);

    return { ok: true, data: { ...after, warning }, changes, action: 'Updated verification' };
}
