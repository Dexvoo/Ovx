/**
 * The dashboard side of the invite blocker: what the page sees, checking a save, and describing it for the Web Logs.
 */

export const INVITE_LIMITS = Object.freeze({ IGNORED_CHANNELS_MAX: 50, IGNORED_ROLES_MAX: 25 });
const TOGGLES = ['enabled', 'allowOwnInvites', 'notify', 'warn'];

/**
 * @param {import('../models/inviteConfig.js').InviteConfigType} config
 */
export function inviteView(config) {
    return {
        enabled: config.enabled,
        allowOwnInvites: config.allowOwnInvites,
        notify: config.notify,
        warn: config.warn,
        ignoredChannelIds: [...config.ignoredChannelIds],
        ignoredRoleIds: [...config.ignoredRoleIds],
    };
}

/**
 * @param {unknown} input
 * @param {import('../../../dashboard/validation.js').GuildContext} guild
 */
export function validateInviteSettings(input, guild) {
    const errors = [];
    const data = input && typeof input === 'object' ? /** @type {any} */ (input) : {};
    /** @type {Record<string, unknown>} */
    const settings = {};

    for (const key of TOGGLES) {
        if (typeof data[key] !== 'boolean') errors.push(`${key} must be on or off`);
        else settings[key] = data[key];
    }

    const idList = (key, exists, max, label) => {
        const value = data[key];
        if (!Array.isArray(value) || value.some((id) => typeof id !== 'string')) {
            errors.push(`${label} must be a list`);
            return;
        }
        const unique = [...new Set(value)];
        if (unique.length > max) errors.push(`Choose at most ${max} ${label.toLowerCase()}`);
        else if (unique.some((id) => !exists(id))) errors.push(`One of the ${label.toLowerCase()} no longer exists`);
        else settings[key] = unique;
    };
    idList(
        'ignoredChannelIds',
        (id) => guild.channelIds.has(id),
        INVITE_LIMITS.IGNORED_CHANNELS_MAX,
        'Ignored channels'
    );
    idList('ignoredRoleIds', (id) => guild.roles.has(id), INVITE_LIMITS.IGNORED_ROLES_MAX, 'Allowed roles');

    return { settings: errors.length ? null : settings, errors };
}

/**
 * @param {ReturnType<typeof inviteView>} before
 * @param {ReturnType<typeof inviteView>} after
 * @param {{ channel: (id: string) => string, role: (id: string) => string }} names
 */
export function describeInviteChanges(before, after, names) {
    const onOff = (value) => (value ? 'on' : 'off');
    const labels = {
        enabled: 'Invite blocker',
        allowOwnInvites: 'Allow invites to this server',
        notify: 'Tell the member why',
        warn: 'Give a warning',
    };
    const changes = TOGGLES.filter((key) => before[key] !== after[key]).map(
        (key) => `${labels[key]}: ${onOff(before[key])} → ${onOff(after[key])}`
    );
    const list = (label, key, name) => [
        ...after[key].filter((id) => !before[key].includes(id)).map((id) => `Added ${label}: ${name(id)}`),
        ...before[key].filter((id) => !after[key].includes(id)).map((id) => `Removed ${label}: ${name(id)}`),
    ];
    return [
        ...changes,
        ...list('ignored channel', 'ignoredChannelIds', names.channel),
        ...list('allowed role', 'ignoredRoleIds', names.role),
    ];
}
