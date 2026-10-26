import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * AutoMod and anti-raid settings (the dashboard's AutoMod page).
 *
 * The filters are Discord's own AutoMod rules, made and updated by Ovx: Discord blocks messages before anyone
 * sees them. `ruleIds` remembers which rules are Ovx's, so they're updated in place and rules made by hand
 * in Discord are never touched. Anti-raid is Ovx's own (Discord has no rule for a burst of joins).
 *
 * @typedef {Object} AutomodSettings
 * @property {string | null} alertChannelId - Where Discord posts an alert when a rule blocks something
 * @property {string[]} exemptRoleIds
 * @property {string[]} exemptChannelIds
 * @property {string | null} blockMessage - Shown to the member when their message is blocked
 * @property {{ enabled: boolean }} spam
 * @property {{ enabled: boolean, limit: number, raidProtection: boolean, timeoutMinutes: number }} mentions
 * @property {{ profanity: boolean, sexualContent: boolean, slurs: boolean }} presets
 * @property {{ enabled: boolean, keywords: string[], allowed: string[], timeoutMinutes: number }} words
 * @property {{ enabled: boolean, allowedSites: string[] }} links
 *
 * @typedef {Object} RaidSettings
 * @property {boolean} enabled
 * @property {number} joins - This many joins...
 * @property {number} seconds - ...within this many seconds is a raid
 * @property {'alert' | 'timeout' | 'kick'} action - What happens to members who join during a raid
 * @property {number} pauseInvitesHours - Pause the server's invites for this long when a raid starts (0: don't)
 * @property {string | null} pingRoleId - Pinged in the alert
 * @property {number} minAccountDays - Accounts newer than this are removed when they join (0: off)
 *
 * @typedef {Object} AutomodConfigType
 * @property {string} guildId
 * @property {AutomodSettings} automod
 * @property {RaidSettings} raid
 * @property {Record<string, string | null>} ruleIds - Ovx's AutoMod rule for each filter
 */

const AutomodConfigSchema = new Schema(
    {
        guildId: { type: String, required: true, unique: true },
        automod: { type: Schema.Types.Mixed, default: null },
        raid: { type: Schema.Types.Mixed, default: null },
        ruleIds: { type: Schema.Types.Mixed, default: {} },
    },
    { minimize: false }
);

export const AutomodConfig = model('Guild-Automod-Config', AutomodConfigSchema);

/** Sites links are allowed to by default: GIFs from the GIF picker, and Discord's own links. */
export const DEFAULT_ALLOWED_SITES = Object.freeze([
    'tenor.com',
    'giphy.com',
    'discord.com',
    'discordapp.com',
    'discordapp.net',
]);

/** @returns {AutomodSettings} */
export function automodDefaults() {
    return {
        alertChannelId: null,
        exemptRoleIds: [],
        exemptChannelIds: [],
        blockMessage: null,
        spam: { enabled: false },
        mentions: { enabled: false, limit: 5, raidProtection: true, timeoutMinutes: 0 },
        presets: { profanity: false, sexualContent: false, slurs: false },
        words: { enabled: false, keywords: [], allowed: [], timeoutMinutes: 0 },
        links: { enabled: false, allowedSites: [...DEFAULT_ALLOWED_SITES] },
    };
}

/** @returns {RaidSettings} */
export function raidDefaults() {
    return {
        enabled: false,
        joins: 10,
        seconds: 30,
        action: 'alert',
        pauseInvitesHours: 0,
        pingRoleId: null,
        minAccountDays: 0,
    };
}

/**
 * A stored config with defaults filled in, so settings added later always have a value.
 * @param {string} guildId
 * @param {any} [stored]
 * @returns {AutomodConfigType}
 */
export function withAutomodDefaults(guildId, stored = null) {
    const automod = automodDefaults();
    const savedAutomod = stored?.automod ?? {};
    for (const key of Object.keys(automod)) {
        if (savedAutomod[key] === undefined) continue;
        const fallback = automod[key];
        automod[key] =
            fallback && typeof fallback === 'object' && !Array.isArray(fallback)
                ? { ...fallback, ...savedAutomod[key] }
                : savedAutomod[key];
    }
    return {
        guildId,
        automod,
        raid: { ...raidDefaults(), ...(stored?.raid ?? {}) },
        ruleIds: { ...(stored?.ruleIds ?? {}) },
    };
}
