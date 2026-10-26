import NodeCache from 'node-cache';
import { GuildSettings } from '../models/guildSettings.js';
import { LogData } from '../utils/logger.js';

/**
 * @typedef {import('../models/guildSettings.js').GuildSettingsType} GuildSettingsType
 */

/** The bot's default embed colour (Discord's DarkPurple). */
export const DEFAULT_EMBED_COLOUR = '#71368a';

class GuildSettingsCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * The settings for a guild, using the cache if available. Never throws: on a database error
     * the defaults are returned so embeds can still be sent.
     * @param {string} guildId
     * @returns {Promise<GuildSettingsType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {GuildSettingsType} */ (cached);

        try {
            const settings = /** @type {GuildSettingsType | null} */ (await GuildSettings.findOne({ guildId }).lean());
            const result = settings ?? this.createDefault(guildId);
            this.cache.set(guildId, result);
            return result;
        } catch (error) {
            LogData('Guild Settings Cache', `Failed to get settings for ${guildId}: ${error.message}`, 'error');
            return this.createDefault(guildId);
        }
    }

    /**
     * Saves some settings and refreshes the cache.
     * @param {string} guildId
     * @param {Partial<Omit<GuildSettingsType, 'guildId'>>} updates - Must already be validated
     * @returns {Promise<GuildSettingsType>}
     */
    async set(guildId, updates) {
        const settings = await GuildSettings.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        this.cache.set(guildId, settings);
        return /** @type {GuildSettingsType} */ (settings);
    }

    /**
     * @param {string} guildId
     * @returns {GuildSettingsType}
     */
    createDefault(guildId) {
        return { guildId, embedColour: null, bio: null, premiumUntil: null };
    }

    /**
     * Forgets a guild's cached settings, so the next read comes from the database (e.g. after another
     * shard changed them).
     * @param {string} guildId
     */
    invalidate(guildId) {
        this.cache.del(guildId);
    }
}

const Guild_Settings_Cache = new GuildSettingsCache();
export default Guild_Settings_Cache;

/** Premium granted without an end date is stored as this date. */
export const PREMIUM_FOREVER = new Date('9999-12-31T00:00:00Z');

/**
 * Whether a server has premium right now.
 * @param {string} guildId
 * @returns {Promise<boolean>}
 */
export async function isPremium(guildId) {
    const { premiumUntil } = await Guild_Settings_Cache.get(guildId);
    return Boolean(premiumUntil && new Date(premiumUntil).getTime() > Date.now());
}

/**
 * The colour for the bot's general (non-log) embeds in a server.
 * @param {string | null | undefined} guildId - null/undefined (e.g. in DMs) gives the default
 * @returns {Promise<`#${string}`>}
 */
export async function brandColour(guildId) {
    if (!guildId) return /** @type {`#${string}`} */ (DEFAULT_EMBED_COLOUR);
    const { embedColour } = await Guild_Settings_Cache.get(guildId);
    return /** @type {`#${string}`} */ (embedColour ?? DEFAULT_EMBED_COLOUR);
}
