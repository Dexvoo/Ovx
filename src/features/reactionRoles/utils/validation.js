import { cleanText, parseButtonEmoji } from '../../../dashboard/validation.js';
import { PANEL_MODES, BUTTON_STYLES } from '../models/reactionRolePanel.js';

export const REACTION_ROLE_LIMITS = Object.freeze({
    PANELS_MAX: 25,
    /** Discord allows 5 rows of 5 buttons */
    BUTTONS_MAX: 25,
    TITLE_MAX: 256,
    DESCRIPTION_MAX: 2000,
    LABEL_MAX: 80,
});

const HEX_COLOUR = /^#[\da-f]{6}$/i;

/**
 * Checks a panel from the dashboard.
 * @param {unknown} input
 * @param {import('../../../dashboard/validation.js').GuildContext} guild
 */
export function validatePanel(input, guild) {
    /** @type {string[]} */
    const errors = [];
    const data = input && typeof input === 'object' ? /** @type {any} */ (input) : {};
    const L = REACTION_ROLE_LIMITS;

    const title = cleanText(data.title ?? null, 'The title', L.TITLE_MAX, { multiline: false }, errors);
    if (title === null) errors.push('Enter a title.');
    const description = cleanText(data.description ?? null, 'The text', L.DESCRIPTION_MAX, { multiline: true }, errors);

    const colour = data.colour === null || data.colour === '' || data.colour === undefined ? null : data.colour;
    if (colour !== null && !(typeof colour === 'string' && HEX_COLOUR.test(colour))) {
        errors.push('The colour must be a hex colour like #b69cff.');
    }

    if (!guild.textChannelIds.has(data.channelId)) errors.push('Choose a text channel Ovx can post in.');

    const mode = PANEL_MODES.includes(data.mode) ? data.mode : null;
    if (!mode) errors.push('Choose how the panel works.');

    const requiredRoleId = data.requiredRoleId || null;
    if (requiredRoleId !== null && !guild.roles.has(requiredRoleId)) errors.push('The required role no longer exists.');

    const maxRoles = mode === 'normal' ? Number(data.maxRoles ?? 0) : 0;
    if (!Number.isInteger(maxRoles) || maxRoles < 0 || maxRoles > L.BUTTONS_MAX) {
        errors.push(`The most roles someone can pick must be between 0 (no limit) and ${L.BUTTONS_MAX}.`);
    }

    const buttons = [];
    const rawButtons = Array.isArray(data.buttons) ? data.buttons : [];
    if (rawButtons.length === 0) errors.push('Add at least one role.');
    if (rawButtons.length > L.BUTTONS_MAX) errors.push(`A panel can have at most ${L.BUTTONS_MAX} roles.`);

    const seen = new Set();
    rawButtons.slice(0, L.BUTTONS_MAX).forEach((raw, index) => {
        const item = raw && typeof raw === 'object' ? raw : {};
        const name = `Role ${index + 1}`;
        const role = guild.roles.get(item.roleId);
        if (!role) {
            errors.push(`${name}: choose a role.`);
            return;
        }
        if (role.managed) errors.push(`${name}: that role is managed by an integration, so it can't be given out.`);
        else if (role.position >= guild.botHighestRolePosition) {
            errors.push(
                `${name}: that role is above Ovx's highest role, so Ovx can't give it. Move Ovx's role higher.`
            );
        }
        if (seen.has(item.roleId)) errors.push(`${name}: that role is already on this panel.`);
        seen.add(item.roleId);

        const label = cleanText(item.label ?? null, `${name}'s label`, L.LABEL_MAX, { multiline: false }, errors);
        const emoji = parseButtonEmoji(item.emoji ?? null, guild.emojiIds);
        if (!emoji.ok) errors.push(`${name}: the emoji must be a single emoji, or one of this server's emojis.`);
        const style = BUTTON_STYLES.includes(item.style) ? item.style : 'secondary';

        buttons.push({ roleId: item.roleId, label: label ?? null, emoji: emoji.ok ? emoji.emoji : null, style });
    });

    if (errors.length > 0) return { panel: null, errors };
    return {
        panel: {
            title: /** @type {string} */ (title),
            description: description ?? null,
            colour: colour ? colour.toLowerCase() : null,
            channelId: /** @type {string} */ (data.channelId),
            mode: /** @type {string} */ (mode),
            requiredRoleId,
            maxRoles,
            buttons,
        },
        errors,
    };
}
