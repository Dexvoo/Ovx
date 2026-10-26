/**
 * Validation for settings submitted from the dashboard.
 * Pure (no Discord or database access) so it can be unit-tested; shardHandlers.js supplies the guild data.
 *
 * Security notes:
 * - Output objects are built from scratch with known keys only, so unexpected or malicious keys
 *   (including __proto__ / constructor) in the request can never reach the database.
 * - Every ID must belong to the guild, and limits match the slash commands.
 */

export const LIMITS = Object.freeze({
    MESSAGE_COOLDOWN_MIN: 20,
    MESSAGE_COOLDOWN_MAX: 3600,
    MAX_LEVEL_MIN: 1,
    MAX_LEVEL_MAX: 10000,
    LEVEL_UP_MESSAGE_MAX: 500,
    MAX_REWARDS: 50,
    MAX_BLACKLIST: 100,
});

const SNOWFLAKE = /^\d{17,20}$/;

const LEVEL_SETTING_KEYS = new Set([
    'enabled',
    'channelId',
    'levelUpMessage',
    'messageCooldown',
    'maxLevel',
    'removePastRewards',
    'publicLeaderboard',
    'rewards',
    'blacklisted',
]);

/**
 * What the validator needs to know about the guild.
 * @typedef {Object} GuildContext
 * @property {Set<string>} textChannelIds - Channels the bot can post level-up messages in
 * @property {Set<string>} channelIds - All channels (for the XP blacklist, which includes voice)
 * @property {Map<string, { position: number, managed: boolean }>} roles - Excluding the everyone role
 * @property {number} botHighestRolePosition
 * @property {Set<string>} [categoryIds] - Categories the bot can create ticket channels in
 * @property {Set<string>} [emojiIds] - The server's custom emojis
 */

/**
 * Validates a level settings update. Only the fields present are validated and returned,
 * so the dashboard can save a single section at a time.
 *
 * @param {unknown} input - Parsed request body
 * @param {GuildContext} guild
 * @param {{ maxLevel: number, enabled: boolean, channelId: string | null }} current - The saved config, for checks that depend on it
 * @returns {{ settings: Record<string, any>, errors: string[] }}
 */
export function validateLevelSettings(input, guild, current) {
    const errors = [];
    const settings = {};

    if (!isPlainObject(input)) return { settings, errors: ['Settings must be an object'] };

    for (const key of Object.keys(input)) {
        if (!LEVEL_SETTING_KEYS.has(key)) errors.push(`Unknown setting "${key}"`);
    }
    if (Object.keys(input).length === 0) errors.push('No settings to save');
    if (errors.length > 0) return { settings, errors };

    const has = (key) => Object.prototype.hasOwnProperty.call(input, key);

    for (const key of ['enabled', 'removePastRewards', 'publicLeaderboard']) {
        if (!has(key)) continue;
        if (typeof input[key] === 'boolean') settings[key] = input[key];
        else errors.push(`${key} must be true or false`);
    }

    if (has('channelId')) {
        const { channelId } = input;
        if (channelId === null) settings.channelId = null;
        else if (typeof channelId !== 'string' || !guild.textChannelIds.has(channelId)) {
            errors.push('The level-up channel must be a text channel in this server that the bot can post in');
        } else settings.channelId = channelId;
    }

    if (has('levelUpMessage')) {
        const { levelUpMessage } = input;
        if (levelUpMessage === null) settings.levelUpMessage = null;
        else if (typeof levelUpMessage !== 'string') errors.push('The level-up message must be text');
        else {
            const trimmed = levelUpMessage.trim();
            if (trimmed.length > LIMITS.LEVEL_UP_MESSAGE_MAX) {
                errors.push(`The level-up message can be at most ${LIMITS.LEVEL_UP_MESSAGE_MAX} characters`);
            } else {
                // Empty means "use the default message"
                settings.levelUpMessage = trimmed || null;
            }
        }
    }

    if (has('messageCooldown')) {
        const value = integerInRange(input.messageCooldown, LIMITS.MESSAGE_COOLDOWN_MIN, LIMITS.MESSAGE_COOLDOWN_MAX);
        if (value === null) {
            errors.push(
                `The message cooldown must be a whole number of seconds between ${LIMITS.MESSAGE_COOLDOWN_MIN} and ${LIMITS.MESSAGE_COOLDOWN_MAX}`
            );
        } else settings.messageCooldown = value;
    }

    if (has('maxLevel')) {
        const value = integerInRange(input.maxLevel, LIMITS.MAX_LEVEL_MIN, LIMITS.MAX_LEVEL_MAX);
        if (value === null) {
            errors.push(
                `The max level must be a whole number between ${LIMITS.MAX_LEVEL_MIN} and ${LIMITS.MAX_LEVEL_MAX}`
            );
        } else settings.maxLevel = value;
    }

    // Rewards are checked against the max level being saved now, or the current one
    const maxLevel = settings.maxLevel ?? current.maxLevel;

    if (has('rewards')) {
        const rewards = validateRewards(input.rewards, guild, maxLevel, errors);
        if (rewards) settings.rewards = rewards;
    }

    if (has('blacklisted')) {
        const blacklisted = validateBlacklist(input.blacklisted, guild, errors);
        if (blacklisted) settings.blacklisted = blacklisted;
    }

    // XP is only granted when a level-up channel is set, so don't allow "enabled" without one
    const enabledAfterSave = settings.enabled ?? current.enabled;
    const channelAfterSave = has('channelId') ? settings.channelId : current.channelId;
    if (enabledAfterSave && !channelAfterSave && !errors.length) {
        errors.push('Choose a level-up channel before enabling levels');
    }

    return errors.length > 0 ? { settings: {}, errors } : { settings, errors };
}

/**
 * @param {unknown} input
 * @param {GuildContext} guild
 * @param {number} maxLevel
 * @param {string[]} errors
 */
function validateRewards(input, guild, maxLevel, errors) {
    if (!Array.isArray(input)) {
        errors.push('Rewards must be a list');
        return null;
    }
    if (input.length > LIMITS.MAX_REWARDS) {
        errors.push(`You can have at most ${LIMITS.MAX_REWARDS} level rewards`);
        return null;
    }

    const rewards = [];
    const levels = new Set();
    const roleIds = new Set();

    for (const [index, reward] of input.entries()) {
        const label = `Reward ${index + 1}`;
        if (!isPlainObject(reward)) {
            errors.push(`${label} is not valid`);
            continue;
        }

        const level = integerInRange(reward.level, 1, maxLevel);
        if (level === null) errors.push(`${label}: the level must be a whole number between 1 and ${maxLevel}`);
        else if (levels.has(level)) errors.push(`${label}: there is already a reward for level ${level}`);

        const role = typeof reward.roleId === 'string' ? guild.roles.get(reward.roleId) : undefined;
        if (reward.roleId === null || reward.roleId === undefined || reward.roleId === '') {
            errors.push(`${label}: choose a role`);
        } else if (!role) errors.push(`${label}: the role is not in this server`);
        else if (role.managed) errors.push(`${label}: that role is managed by an integration and can't be given out`);
        else if (role.position >= guild.botHighestRolePosition) {
            errors.push(`${label}: the role is above the bot's highest role, so the bot can't give it`);
        } else if (roleIds.has(reward.roleId)) errors.push(`${label}: that role is already a reward`);

        if (level !== null && role) {
            levels.add(level);
            roleIds.add(reward.roleId);
            rewards.push({ level, roleId: reward.roleId });
        }
    }

    return rewards.sort((a, b) => a.level - b.level);
}

/**
 * @param {unknown} input
 * @param {GuildContext} guild
 * @param {string[]} errors
 */
function validateBlacklist(input, guild, errors) {
    if (!isPlainObject(input)) {
        errors.push('The blacklist must have roleIds and channelIds lists');
        return null;
    }

    const roleIds = validateIdList(input.roleIds, (id) => guild.roles.has(id), 'Blacklisted roles', errors);
    const channelIds = validateIdList(
        input.channelIds,
        (id) => guild.channelIds.has(id),
        'Blacklisted channels',
        errors
    );
    return roleIds && channelIds ? { roleIds, channelIds } : null;
}

/**
 * @param {unknown} input
 * @param {(id: string) => boolean} exists
 * @param {string} label
 * @param {string[]} errors
 * @returns {string[] | null}
 */
function validateIdList(input, exists, label, errors) {
    if (!Array.isArray(input)) {
        errors.push(`${label} must be a list`);
        return null;
    }
    if (input.length > LIMITS.MAX_BLACKLIST) {
        errors.push(`${label}: at most ${LIMITS.MAX_BLACKLIST} allowed`);
        return null;
    }

    const ids = [];
    for (const id of input) {
        if (typeof id !== 'string' || !SNOWFLAKE.test(id) || !exists(id)) {
            errors.push(`${label}: one or more are not in this server`);
            return null;
        }
        if (!ids.includes(id)) ids.push(id);
    }
    return ids;
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @returns {number | null}
 */
function integerInRange(value, min, max) {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/**
 * True for {}-style objects only (not arrays, null, or class instances).
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/** Log types the dashboard offers (all of them; same names as LOG_TYPES in features/logging/models/logging.js). */
export const DASHBOARD_LOG_TYPES = Object.freeze([
    'message',
    'channel',
    'member',
    'join',
    'leave',
    'voice',
    'role',
    'server',
    'punishment',
]);

const LOGGING_SETTING_KEYS = new Set(['types', 'ignoredChannels']);

/**
 * Validates a logging settings update.
 * Shape: { types?: { [logType]: { enabled: boolean, channelId: string | null } }, ignoredChannels?: string[] }
 * Only the log types and fields present are returned, so one section can be saved at a time.
 *
 * @param {unknown} input - Parsed request body
 * @param {GuildContext} guild - textChannelIds are the channels the bot can post log embeds in
 * @returns {{ settings: Record<string, any>, errors: string[] }} settings maps straight onto the logs config
 */
export function validateLoggingSettings(input, guild) {
    const errors = [];
    const settings = {};

    if (!isPlainObject(input)) return { settings, errors: ['Settings must be an object'] };

    for (const key of Object.keys(input)) {
        if (!LOGGING_SETTING_KEYS.has(key)) errors.push(`Unknown setting "${key}"`);
    }
    if (Object.keys(input).length === 0) errors.push('No settings to save');
    if (errors.length > 0) return { settings, errors };

    if (Object.prototype.hasOwnProperty.call(input, 'types')) {
        const { types } = input;
        if (!isPlainObject(types)) {
            errors.push('Log types must be an object');
        } else {
            for (const [type, value] of Object.entries(types)) {
                if (!DASHBOARD_LOG_TYPES.includes(type)) {
                    errors.push(`Unknown log type "${type}"`);
                    continue;
                }
                const label = `${type.charAt(0).toUpperCase()}${type.slice(1)} logs`;

                if (!isPlainObject(value) || typeof value.enabled !== 'boolean') {
                    errors.push(`${label}: enabled must be true or false`);
                    continue;
                }
                const { enabled, channelId } = value;

                if (channelId !== null && (typeof channelId !== 'string' || !guild.textChannelIds.has(channelId))) {
                    errors.push(`${label}: the channel must be a text channel in this server that the bot can post in`);
                    continue;
                }
                if (enabled && !channelId) {
                    errors.push(`${label}: choose a channel before turning them on`);
                    continue;
                }

                settings[type] = { enabled, channelId };
            }
        }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'ignoredChannels')) {
        const ignoredChannels = validateIdList(
            input.ignoredChannels,
            (id) => guild.channelIds.has(id),
            'Ignored channels',
            errors
        );
        if (ignoredChannels) settings.ignoredChannels = ignoredChannels;
    }

    return errors.length > 0 ? { settings: {}, errors } : { settings, errors };
}

/** Discord's limit for nicknames. */
export const NICKNAME_MAX = 32;
/** Discord's limit for a bot's About Me in a server. */
export const BIO_MAX = 190;
/** Uploaded avatars and banners (after the browser shrinks them; animated GIFs are sent as they are). */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const BOT_SETTING_KEYS = new Set(['nickname', 'avatar', 'banner', 'bio', 'embedColour']);
const ZERO_WIDTH_JOINER = String.fromCharCode(0x200d); // Joins emojis into one (e.g. family emojis), so it's allowed
const HEX_COLOUR = /^#[\da-f]{6}$/i;
const DATA_URL = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z\d+/]+={0,2})$/;

/**
 * Validates the bot's settings for a server. Fields left out are unchanged.
 * Shape: { nickname?, avatar?, banner?, bio?, embedColour? }; null resets a field to the default.
 * Discord has a few more rules for nicknames and images; anything it rejects is reported back by the save.
 *
 * @param {unknown} input - Parsed request body
 * @returns {{ settings: { nickname?: string | null, avatar?: string | null, banner?: string | null,
 *   bio?: string | null, embedColour?: string | null }, errors: string[] }}
 */
export function validateBotSettings(input) {
    const errors = [];
    const settings = {};

    if (!isPlainObject(input)) return { settings, errors: ['Settings must be an object'] };

    for (const key of Object.keys(input)) {
        if (!BOT_SETTING_KEYS.has(key)) errors.push(`Unknown setting "${key}"`);
    }
    if (Object.keys(input).length === 0) errors.push('No settings to save');
    if (errors.length > 0) return { settings, errors };

    const has = (key) => Object.prototype.hasOwnProperty.call(input, key);

    if (has('nickname')) {
        const nickname = cleanText(input.nickname, 'Nickname', NICKNAME_MAX, { multiline: false }, errors);
        if (nickname !== undefined) settings.nickname = nickname;
    }

    if (has('bio')) {
        const bio = cleanText(input.bio, 'About Me', BIO_MAX, { multiline: true }, errors);
        if (bio !== undefined) settings.bio = bio;
    }

    for (const [key, label] of /** @type {const} */ ([
        ['avatar', 'Avatar'],
        ['banner', 'Banner'],
    ])) {
        if (!has(key)) continue;
        const image = parseImage(input[key], label, errors);
        if (image !== undefined) settings[key] = image;
    }

    if (has('embedColour')) {
        const { embedColour } = input;
        if (embedColour === null) settings.embedColour = null;
        else if (typeof embedColour === 'string' && HEX_COLOUR.test(embedColour)) {
            settings.embedColour = embedColour.toLowerCase();
        } else errors.push('Embed colour must be a colour like #a78bfa');
    }

    return { settings, errors };
}

/**
 * Trims text and checks its length (counted the way people see it, so an emoji counts as one character)
 * and that it has no hidden characters, such as ones that flip the text direction.
 * @param {unknown} value
 * @param {string} label
 * @param {number} max
 * @param {{ multiline: boolean }} options
 * @param {string[]} errors
 * @returns {string | null | undefined} null for empty, undefined if not valid
 */
export function cleanText(value, label, max, { multiline }, errors) {
    if (value !== null && typeof value !== 'string') {
        errors.push(`${label} must be text`);
        return undefined;
    }
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if ([...trimmed].length > max) {
        errors.push(`${label} can be at most ${max} characters`);
        return undefined;
    }
    const allowed = multiline ? trimmed.replaceAll('\n', '') : trimmed;
    if (/[\p{Cc}\p{Cf}]/u.test(allowed.replaceAll(ZERO_WIDTH_JOINER, ''))) {
        errors.push(`${label} contains characters that are not allowed`);
        return undefined;
    }
    return trimmed || null;
}

/**
 * Checks an uploaded image (a data URL). The file's own bytes decide its type, not what the browser
 * claimed, so a file that isn't really an image is refused.
 * @param {unknown} value
 * @param {string} label
 * @param {string[]} errors
 * @returns {string | null | undefined} The data URL, null to remove it, undefined if not valid
 */
function parseImage(value, label, errors) {
    if (value === null) return null;
    const match = typeof value === 'string' ? DATA_URL.exec(value) : null;
    if (!match) {
        errors.push(`${label} must be a PNG, JPEG, GIF or WebP image`);
        return undefined;
    }

    // Checked before decoding so a huge upload is never decoded
    if (match[2].length > Math.ceil(IMAGE_MAX_BYTES / 3) * 4) {
        errors.push(`${label} must be ${IMAGE_MAX_BYTES / 1024 / 1024} MB or smaller`);
        return undefined;
    }

    const type = imageType(Buffer.from(match[2], 'base64'));
    if (!type) {
        errors.push(`${label} must be a PNG, JPEG, GIF or WebP image`);
        return undefined;
    }
    return `data:image/${type};base64,${match[2]}`;
}

/**
 * Detects an image type from its first bytes.
 * @param {Buffer} bytes
 * @returns {'png' | 'jpeg' | 'gif' | 'webp' | null}
 */
export function imageType(bytes) {
    const starts = (values, offset = 0) => values.every((value, index) => bytes[offset + index] === value);
    if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
    if (starts([0xff, 0xd8, 0xff])) return 'jpeg';
    if (starts([0x47, 0x49, 0x46, 0x38])) return 'gif';
    if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
    return null;
}

/** Most roles each auto role list can have. */
export const AUTO_ROLES_MAX = 10;

const AUTO_ROLE_SETTING_KEYS = new Set(['enabled', 'humanRoleIds', 'botRoleIds']);

/**
 * Validates auto role settings. Fields left out are unchanged.
 * Shape: { enabled?: boolean, humanRoleIds?: string[], botRoleIds?: string[] }
 *
 * @param {unknown} input - Parsed request body
 * @param {GuildContext} guild
 * @returns {{ settings: { enabled?: boolean, humanRoleIds?: string[], botRoleIds?: string[] }, errors: string[] }}
 */
export function validateAutoRoleSettings(input, guild) {
    const errors = [];
    const settings = {};

    if (!isPlainObject(input)) return { settings, errors: ['Settings must be an object'] };

    for (const key of Object.keys(input)) {
        if (!AUTO_ROLE_SETTING_KEYS.has(key)) errors.push(`Unknown setting "${key}"`);
    }
    if (Object.keys(input).length === 0) errors.push('No settings to save');
    if (errors.length > 0) return { settings, errors };

    const has = (key) => Object.prototype.hasOwnProperty.call(input, key);

    if (has('enabled')) {
        if (typeof input.enabled === 'boolean') settings.enabled = input.enabled;
        else errors.push('Enabled must be true or false');
    }

    for (const [key, label] of /** @type {const} */ ([
        ['humanRoleIds', 'Roles for new members'],
        ['botRoleIds', 'Roles for new bots'],
    ])) {
        if (!has(key)) continue;
        const roleIds = validateGivableRoles(input[key], guild, label, errors);
        if (roleIds) settings[key] = roleIds;
    }

    return { settings, errors };
}

/**
 * A list of roles the bot will hand out: each must exist, not be managed by an integration,
 * and be below the bot's highest role.
 * @param {unknown} input
 * @param {GuildContext} guild
 * @param {string} label
 * @param {string[]} errors
 * @returns {string[] | null}
 */
function validateGivableRoles(input, guild, label, errors) {
    if (!Array.isArray(input)) {
        errors.push(`${label} must be a list`);
        return null;
    }
    if (input.length > AUTO_ROLES_MAX) {
        errors.push(`${label}: at most ${AUTO_ROLES_MAX} roles`);
        return null;
    }

    const roleIds = [];
    for (const id of input) {
        const role = typeof id === 'string' && SNOWFLAKE.test(id) ? guild.roles.get(id) : undefined;
        if (!role) {
            errors.push(`${label}: one or more roles are not in this server`);
            return null;
        }
        if (role.managed) {
            errors.push(`${label}: a role managed by an integration can't be given out`);
            return null;
        }
        if (role.position >= guild.botHighestRolePosition) {
            errors.push(`${label}: a role is above the bot's highest role, so the bot can't give it`);
            return null;
        }
        if (!roleIds.includes(id)) roleIds.push(id);
    }
    return roleIds;
}

/** Limits for welcome and goodbye messages (leaving room for placeholders to grow). */
export const WELCOME_LIMITS = Object.freeze({ MESSAGE_MAX: 1500, TITLE_MAX: 200 });

const WELCOME_KINDS = ['welcome', 'goodbye'];
const WELCOME_MESSAGE_KEYS = new Set(['enabled', 'channelId', 'message', 'embed', 'title']);

/**
 * Validates welcome and goodbye message settings. Each one sent is replaced as a whole.
 * Shape: { welcome?: Message, goodbye?: Message }
 * Message: { enabled: boolean, channelId: string | null, message: string | null, embed: boolean, title: string | null }
 *
 * @param {unknown} input - Parsed request body
 * @param {GuildContext} guild - textChannelIds are the channels the bot can post embeds in
 * @returns {{ settings: Record<string, any>, errors: string[] }}
 */
export function validateWelcomeSettings(input, guild) {
    const errors = [];
    const settings = {};

    if (!isPlainObject(input)) return { settings, errors: ['Settings must be an object'] };
    for (const key of Object.keys(input)) {
        if (!WELCOME_KINDS.includes(key)) errors.push(`Unknown setting "${key}"`);
    }
    if (Object.keys(input).length === 0) errors.push('No settings to save');
    if (errors.length > 0) return { settings, errors };

    for (const kind of WELCOME_KINDS) {
        if (!Object.prototype.hasOwnProperty.call(input, kind)) continue;
        const label = kind === 'welcome' ? 'Welcome message' : 'Goodbye message';
        const value = input[kind];

        if (!isPlainObject(value)) {
            errors.push(`${label}: settings are not valid`);
            continue;
        }
        const unknown = Object.keys(value).find((key) => !WELCOME_MESSAGE_KEYS.has(key));
        if (unknown) {
            errors.push(`${label}: unknown setting "${unknown}"`);
            continue;
        }
        if (typeof value.enabled !== 'boolean' || typeof value.embed !== 'boolean') {
            errors.push(`${label}: on/off settings must be true or false`);
            continue;
        }

        const { channelId } = value;
        if (channelId !== null && (typeof channelId !== 'string' || !guild.textChannelIds.has(channelId))) {
            errors.push(`${label}: the channel must be a text channel in this server that the bot can post in`);
            continue;
        }
        if (value.enabled && !channelId) {
            errors.push(`${label}: choose a channel before turning it on`);
            continue;
        }

        const message = optionalText(value.message, WELCOME_LIMITS.MESSAGE_MAX, `${label}`, errors);
        const title = optionalText(value.title, WELCOME_LIMITS.TITLE_MAX, `${label} title`, errors);
        if (message === undefined || title === undefined) continue;

        settings[kind] = { enabled: value.enabled, channelId, message, embed: value.embed, title };
    }

    return { settings, errors };
}

/**
 * Optional multi-line text: trimmed, empty becomes null.
 * @param {unknown} value
 * @param {number} max
 * @param {string} label
 * @param {string[]} errors
 * @returns {string | null | undefined} undefined if not valid
 */
function optionalText(value, max, label, errors) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') {
        errors.push(`${label} must be text`);
        return undefined;
    }
    const trimmed = value.trim();
    if (trimmed.length > max) {
        errors.push(`${label} can be at most ${max} characters`);
        return undefined;
    }
    return trimmed || null;
}

/** Limits for ticket settings (Discord's own limits for the panel embed and button). */
export const TICKET_LIMITS = Object.freeze({
    STAFF_ROLES_MAX: 10,
    MAX_OPEN_MIN: 1,
    MAX_OPEN_MAX: 5,
    OPEN_MESSAGE_MAX: 1000,
    PANEL_TITLE_MAX: 256,
    PANEL_DESCRIPTION_MAX: 2000,
    BUTTON_LABEL_MAX: 80,
});

const TICKET_SETTING_KEYS = new Set([
    'enabled',
    'categoryId',
    'transcriptChannelId',
    'staffRoleIds',
    'pingStaff',
    'maxOpenPerUser',
    'ownerCanClose',
    'dmTranscript',
    'openMessage',
    'panel',
    'ticketTypes',
]);
/** @type {Readonly<Record<string, [number, string]>>} */
const TICKET_PANEL_LIMITS = Object.freeze({
    title: [TICKET_LIMITS.PANEL_TITLE_MAX, 'Panel title'],
    description: [TICKET_LIMITS.PANEL_DESCRIPTION_MAX, 'Panel text'],
    buttonLabel: [TICKET_LIMITS.BUTTON_LABEL_MAX, 'Button label'],
});
const TICKET_TOGGLES = ['enabled', 'pingStaff', 'ownerCanClose', 'dmTranscript'];

/**
 * Validates ticket settings. Fields left out are unchanged.
 * The panel's channel isn't set here: posting the panel sets it (see shardHandlers.js postTicketPanel).
 *
 * @param {unknown} input - Parsed request body
 * @param {GuildContext} guild
 * @param {{ categoryId: string | null }} current - The saved settings, for "needs a category to be on"
 * @returns {{ settings: Record<string, any>, errors: string[] }} Keys map straight onto the config (panel.* dotted)
 */
export function validateTicketSettings(input, guild, current) {
    const errors = [];
    const settings = {};

    if (!isPlainObject(input)) return { settings, errors: ['Settings must be an object'] };
    for (const key of Object.keys(input)) {
        if (!TICKET_SETTING_KEYS.has(key)) errors.push(`Unknown setting "${key}"`);
    }
    if (Object.keys(input).length === 0) errors.push('No settings to save');
    if (errors.length > 0) return { settings, errors };

    const has = (key) => Object.prototype.hasOwnProperty.call(input, key);

    for (const key of TICKET_TOGGLES) {
        if (!has(key)) continue;
        if (typeof input[key] === 'boolean') settings[key] = input[key];
        else errors.push(`${key} must be true or false`);
    }

    if (has('categoryId')) {
        const { categoryId } = input;
        if (categoryId === null) settings.categoryId = null;
        else if (typeof categoryId === 'string' && guild.categoryIds?.has(categoryId)) settings.categoryId = categoryId;
        else errors.push('Ticket category: choose a category in this server');
    }

    if (has('transcriptChannelId')) {
        const channelId = input.transcriptChannelId;
        if (channelId === null) settings.transcriptChannelId = null;
        else if (typeof channelId === 'string' && guild.textChannelIds.has(channelId)) {
            settings.transcriptChannelId = channelId;
        } else errors.push('Transcript channel: choose a text channel the bot can post in');
    }

    if (has('staffRoleIds')) {
        const { staffRoleIds } = input;
        if (!Array.isArray(staffRoleIds) || staffRoleIds.length > TICKET_LIMITS.STAFF_ROLES_MAX) {
            errors.push(`Staff roles: up to ${TICKET_LIMITS.STAFF_ROLES_MAX} roles`);
        } else if (!staffRoleIds.every((id) => typeof id === 'string' && SNOWFLAKE.test(id) && guild.roles.has(id))) {
            errors.push('Staff roles: one or more roles are not in this server');
        } else settings.staffRoleIds = [...new Set(staffRoleIds)];
    }

    if (has('maxOpenPerUser')) {
        const max = integerInRange(input.maxOpenPerUser, TICKET_LIMITS.MAX_OPEN_MIN, TICKET_LIMITS.MAX_OPEN_MAX);
        if (max === null) {
            errors.push(
                `Open tickets per member: a whole number from ${TICKET_LIMITS.MAX_OPEN_MIN} to ${TICKET_LIMITS.MAX_OPEN_MAX}`
            );
        } else settings.maxOpenPerUser = max;
    }

    if (has('openMessage')) {
        const message = optionalText(input.openMessage, TICKET_LIMITS.OPEN_MESSAGE_MAX, 'Ticket message', errors);
        if (message !== undefined) settings.openMessage = message;
    }

    if (has('panel')) {
        const { panel } = input;
        if (!isPlainObject(panel) || Object.keys(panel).some((key) => !Object.hasOwn(TICKET_PANEL_LIMITS, key))) {
            errors.push('Panel: settings are not valid');
        } else {
            for (const [key, [max, label]] of Object.entries(TICKET_PANEL_LIMITS)) {
                if (!Object.prototype.hasOwnProperty.call(panel, key)) continue;
                const value = optionalText(panel[key], max, label, errors);
                if (value === undefined) continue;
                // The title and button label are one line
                settings[`panel.${key}`] = key === 'description' || value === null ? value : collapseSpaces(value);
            }
        }
    }

    if (has('ticketTypes')) {
        const types = validateTicketTypes(input.ticketTypes, guild, errors);
        if (types) settings.ticketTypes = types;
    }

    const categoryAfter = settings.categoryId !== undefined ? settings.categoryId : current.categoryId;
    if (settings.enabled && !categoryAfter) errors.push('Choose a ticket category before turning tickets on');

    return { settings, errors };
}

/**
 * @param {string} text
 */
function collapseSpaces(text) {
    return text.split(/\s+/).join(' ');
}

/** Limits for ticket types. Ten buttons fit on two rows of a panel. */
export const TICKET_TYPE_LIMITS = Object.freeze({
    TYPES_MAX: 10,
    LABEL_MAX: 80,
    DESCRIPTION_MAX: 100,
    PREFIX_MAX: 20,
    ROLES_MAX: 10,
});

const TICKET_TYPE_KEYS = new Set([
    'id',
    'label',
    'emoji',
    'style',
    'description',
    'channelPrefix',
    'categoryId',
    'staffRoleIds',
    'allowedRoleIds',
    'openMessage',
]);
const BUTTON_STYLES = new Set(['primary', 'secondary', 'success', 'danger']);
const TYPE_ID = /^[a-z\d]{1,16}$/;
const CUSTOM_EMOJI = /^<a?:\w{2,32}:(\d{17,20})>$/;
const EMOJI_PARTS = /^[\p{Extended_Pictographic}\p{Emoji_Component}]+$/u;
const KEYCAP = String.fromCharCode(0x20e3);
const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
 * Checks a button emoji: one Unicode emoji, or a custom emoji from this server (the bot can only use those).
 * @param {unknown} value
 * @param {Set<string> | undefined} emojiIds - The server's custom emojis
 * @returns {{ ok: true, emoji: string | null } | { ok: false }}
 */
export function parseButtonEmoji(value, emojiIds) {
    if (value === null || value === '') return { ok: true, emoji: null };
    if (typeof value !== 'string') return { ok: false };
    const text = value.trim();

    const custom = CUSTOM_EMOJI.exec(text);
    if (custom) return emojiIds?.has(custom[1]) ? { ok: true, emoji: text } : { ok: false };

    const isEmoji =
        text.length <= 32 &&
        EMOJI_PARTS.test(text) &&
        (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(text) || text.includes(KEYCAP)) &&
        [...graphemes.segment(text)].length === 1;
    return isEmoji ? { ok: true, emoji: text } : { ok: false };
}

/**
 * Validates the list of ticket types (the whole list is replaced).
 * @param {unknown} input
 * @param {GuildContext} guild
 * @param {string[]} errors
 * @returns {Record<string, any>[] | null}
 */
function validateTicketTypes(input, guild, errors) {
    if (!Array.isArray(input) || input.length > TICKET_TYPE_LIMITS.TYPES_MAX) {
        errors.push(`Ticket types: up to ${TICKET_TYPE_LIMITS.TYPES_MAX}`);
        return null;
    }

    const types = [];
    const ids = new Set();
    for (const [index, type] of input.entries()) {
        const before = errors.length;
        const name = typeof type?.label === 'string' && type.label.trim() ? `"${type.label.trim()}"` : `${index + 1}`;
        const label = `Ticket type ${name}`;

        if (!isPlainObject(type) || Object.keys(type).some((key) => !TICKET_TYPE_KEYS.has(key))) {
            errors.push(`${label}: settings are not valid`);
            continue;
        }
        if (typeof type.id !== 'string' || !TYPE_ID.test(type.id) || ids.has(type.id)) {
            errors.push(`${label}: not valid, refresh the page and try again`);
            continue;
        }

        const buttonLabel = typeof type.label === 'string' ? type.label.trim().split(/\s+/).join(' ') : '';
        if (!buttonLabel || buttonLabel.length > TICKET_TYPE_LIMITS.LABEL_MAX) {
            errors.push(`${label}: the button label must be 1 to ${TICKET_TYPE_LIMITS.LABEL_MAX} characters`);
        }

        const emoji = parseButtonEmoji(type.emoji, guild.emojiIds);
        if (!emoji.ok) errors.push(`${label}: the emoji must be a single emoji, or one of this server's emojis`);

        if (!BUTTON_STYLES.has(type.style)) errors.push(`${label}: choose a button colour`);

        const description = optionalText(
            type.description,
            TICKET_TYPE_LIMITS.DESCRIPTION_MAX,
            `${label} description`,
            errors
        );
        const openMessage = optionalText(type.openMessage, TICKET_LIMITS.OPEN_MESSAGE_MAX, `${label} message`, errors);

        // Channel names: lowercase letters, numbers and dashes
        let channelPrefix = null;
        if (type.channelPrefix !== null && type.channelPrefix !== undefined && type.channelPrefix !== '') {
            channelPrefix =
                typeof type.channelPrefix === 'string'
                    ? type.channelPrefix
                          .trim()
                          .toLowerCase()
                          .replace(/\s+/g, '-')
                          .replace(/[^a-z\d-]/g, '')
                          .replace(/^-+|-+$/g, '')
                    : '';
            if (!channelPrefix || channelPrefix.length > TICKET_TYPE_LIMITS.PREFIX_MAX) {
                errors.push(
                    `${label}: the channel name must be 1 to ${TICKET_TYPE_LIMITS.PREFIX_MAX} letters, numbers or dashes`
                );
            }
        }

        const categoryId = type.categoryId ?? null;
        if (categoryId !== null && (typeof categoryId !== 'string' || !guild.categoryIds?.has(categoryId))) {
            errors.push(`${label}: choose a category in this server`);
        }

        const roleList = (value, what) => {
            if (!Array.isArray(value) || value.length > TICKET_TYPE_LIMITS.ROLES_MAX) {
                errors.push(`${label}: up to ${TICKET_TYPE_LIMITS.ROLES_MAX} ${what}`);
                return [];
            }
            if (!value.every((id) => typeof id === 'string' && SNOWFLAKE.test(id) && guild.roles.has(id))) {
                errors.push(`${label}: one or more ${what} are not in this server`);
                return [];
            }
            return [...new Set(value)];
        };
        const staffRoleIds = roleList(type.staffRoleIds ?? [], 'staff roles');
        const allowedRoleIds = roleList(type.allowedRoleIds ?? [], 'roles that can open it');

        if (errors.length > before) continue;
        ids.add(type.id);
        types.push({
            id: type.id,
            label: buttonLabel,
            emoji: emoji.ok ? emoji.emoji : null,
            style: type.style,
            description,
            channelPrefix,
            categoryId,
            staffRoleIds,
            allowedRoleIds,
            openMessage,
        });
    }
    return types;
}

/** Limits for stream notification messages. */
export const STREAM_MESSAGE_MAX = 500;

const STREAM_PLATFORM_NAMES = new Set(['twitch', 'youtube', 'kick']);
const SUBSCRIPTION_ID = /^[a-f\d]{24}$/i;
const STREAM_UPDATE_KEYS = new Set([
    'id',
    'channelId',
    'roleId',
    'liveMessage',
    'videoMessage',
    'notifyLive',
    'notifyVideos',
]);

/**
 * A role to ping: a role in the server, 'everyone', or null for no ping.
 * @param {unknown} roleId
 * @param {GuildContext} guild
 */
function validPingRole(roleId, guild) {
    return (
        roleId === null ||
        roleId === 'everyone' ||
        (typeof roleId === 'string' && SNOWFLAKE.test(roleId) && guild.roles.has(roleId))
    );
}

/**
 * Validates following a new streamer. The account itself is checked on the platform afterwards.
 * Shape: { platform, query, channelId, roleId? }
 * @param {unknown} input
 * @param {GuildContext} guild
 * @returns {{ settings: { platform?: string, query?: string, channelId?: string, roleId?: string | null }, errors: string[] }}
 */
export function validateStreamAdd(input, guild) {
    const errors = [];
    if (!isPlainObject(input)) return { settings: {}, errors: ['Settings must be an object'] };

    const { platform, query, channelId, roleId = null } = input;
    if (!STREAM_PLATFORM_NAMES.has(platform)) errors.push('Choose Twitch, YouTube or Kick');
    if (typeof query !== 'string' || !query.trim() || query.trim().length > 100) {
        errors.push('Enter a username, channel or link');
    }
    if (typeof channelId !== 'string' || !guild.textChannelIds.has(channelId)) {
        errors.push('Choose a text channel the bot can post in');
    }
    if (!validPingRole(roleId, guild)) errors.push('The role to ping is not in this server');

    return errors.length > 0
        ? { settings: {}, errors }
        : { settings: { platform, query: query.trim(), channelId, roleId }, errors };
}

/**
 * Validates changes to followed streamers (each one sent is replaced as a whole).
 * Shape: [{ id, channelId, roleId, liveMessage, videoMessage, notifyLive, notifyVideos }]
 * @param {unknown} input
 * @param {GuildContext} guild
 * @param {Map<string, string>} existing - Subscription ID → display name, for this server and platform
 * @returns {{ settings: Record<string, any>[], errors: string[] }}
 */
export function validateStreamUpdates(input, guild, existing) {
    const errors = [];
    if (!Array.isArray(input) || input.length === 0 || input.length > 100) {
        return { settings: [], errors: ['Nothing to save'] };
    }

    const updates = [];
    const seen = new Set();
    for (const item of input) {
        if (!isPlainObject(item) || Object.keys(item).some((key) => !STREAM_UPDATE_KEYS.has(key))) {
            errors.push('Settings are not valid');
            continue;
        }
        if (
            typeof item.id !== 'string' ||
            !SUBSCRIPTION_ID.test(item.id) ||
            !existing.has(item.id) ||
            seen.has(item.id)
        ) {
            errors.push('One of these streamers is no longer followed. Refresh the page.');
            continue;
        }
        const label = existing.get(item.id);
        const before = errors.length;

        if (typeof item.channelId !== 'string' || !guild.textChannelIds.has(item.channelId)) {
            errors.push(`${label}: choose a text channel the bot can post in`);
        }
        if (!validPingRole(item.roleId, guild)) errors.push(`${label}: the role to ping is not in this server`);
        if (typeof item.notifyLive !== 'boolean' || typeof item.notifyVideos !== 'boolean') {
            errors.push(`${label}: on/off settings must be true or false`);
        }
        const liveMessage = optionalText(item.liveMessage, STREAM_MESSAGE_MAX, `${label} live message`, errors);
        const videoMessage = optionalText(item.videoMessage, STREAM_MESSAGE_MAX, `${label} video message`, errors);

        if (errors.length > before) continue;
        seen.add(item.id);
        updates.push({
            id: item.id,
            channelId: item.channelId,
            roleId: item.roleId,
            liveMessage,
            videoMessage,
            notifyLive: item.notifyLive,
            notifyVideos: item.notifyVideos,
        });
    }
    return { settings: updates, errors };
}

/**
 * A subscription ID from a URL.
 * @param {unknown} id
 */
export function isSubscriptionId(id) {
    return typeof id === 'string' && SUBSCRIPTION_ID.test(id);
}

// ---------- Moderation ----------

export const WARN_ACTION_LIMITS = Object.freeze({
    RULES: 10,
    WARNINGS: 50,
    MIN_MUTE_MS: 10_000,
    MAX_MUTE_MS: 28 * 24 * 60 * 60_000, // Discord's longest timeout
});
const WARN_ACTION_TYPES = new Set(['mute', 'kick', 'ban']);
const WARN_ACTION_KEYS = new Set(['warnings', 'action', 'durationMs']);

/**
 * Automatic actions after a number of warnings, e.g. a 1 hour mute at 3 warnings.
 * Each warning count can have one rule; they're returned sorted by count.
 * @param {unknown} input
 * @returns {{ settings: { warnActions?: { warnings: number, action: 'mute' | 'kick' | 'ban', durationMs: number | null }[] },
 *   errors: string[] }}
 */
export function validateModerationSettings(input) {
    const errors = [];
    if (!isPlainObject(input)) return { settings: {}, errors: ['Settings must be an object'] };
    for (const key of Object.keys(input)) {
        if (key !== 'warnActions') errors.push(`Unknown setting "${key}"`);
    }
    if (!Array.isArray(input.warnActions)) errors.push('Automatic actions must be a list');
    if (errors.length > 0) return { settings: {}, errors };
    if (input.warnActions.length > WARN_ACTION_LIMITS.RULES) {
        return { settings: {}, errors: [`You can have up to ${WARN_ACTION_LIMITS.RULES} automatic actions`] };
    }

    const rules = [];
    const counts = new Set();
    input.warnActions.forEach((rule, index) => {
        const label = `Automatic action ${index + 1}`;
        if (!isPlainObject(rule) || Object.keys(rule).some((key) => !WARN_ACTION_KEYS.has(key))) {
            errors.push(`${label} is not valid`);
            return;
        }
        const { warnings, action, durationMs } = rule;

        if (!Number.isInteger(warnings) || warnings < 1 || warnings > WARN_ACTION_LIMITS.WARNINGS) {
            errors.push(`${label}: the number of warnings must be from 1 to ${WARN_ACTION_LIMITS.WARNINGS}`);
            return;
        }
        if (counts.has(warnings)) {
            errors.push(`${label}: there is already an action at ${warnings} warnings`);
            return;
        }
        if (!WARN_ACTION_TYPES.has(action)) {
            errors.push(`${label}: choose mute, kick or ban`);
            return;
        }
        if (action === 'mute') {
            const valid =
                Number.isInteger(durationMs) &&
                durationMs >= WARN_ACTION_LIMITS.MIN_MUTE_MS &&
                durationMs <= WARN_ACTION_LIMITS.MAX_MUTE_MS;
            if (!valid) {
                errors.push(`${label}: a mute can be from 10 seconds up to 28 days`);
                return;
            }
        }

        counts.add(warnings);
        rules.push({ warnings, action, durationMs: action === 'mute' ? durationMs : null });
    });

    rules.sort((a, b) => a.warnings - b.warnings);
    return { settings: { warnActions: rules }, errors };
}
