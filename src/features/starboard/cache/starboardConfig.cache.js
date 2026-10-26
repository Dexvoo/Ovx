import NodeCache from 'node-cache';
import { StarboardConfig } from '../models/starboard.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/starboard.js').StarboardConfigType} StarboardConfigType
 */

/** The settings for a server that never set the starboard up. */
export function starboardDefaults(guildId) {
    return {
        guildId,
        enabled: false,
        channelId: null,
        emoji: '⭐',
        threshold: 3,
        selfStar: false,
        allowBots: false,
        removeBelow: true,
        ignoredChannelIds: [],
    };
}

class StarboardConfigCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * Read on every reaction, so it stays cached. A database error counts as off.
     * @param {string} guildId
     * @returns {Promise<StarboardConfigType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {StarboardConfigType} */ (cached);
        try {
            const stored = await StarboardConfig.findOne({ guildId }).lean();
            const result = { ...starboardDefaults(guildId), ...(stored ?? {}) };
            this.cache.set(guildId, result);
            return /** @type {StarboardConfigType} */ (result);
        } catch (error) {
            LogData('Starboard', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return starboardDefaults(guildId);
        }
    }

    /**
     * @param {string} guildId
     * @param {Partial<Omit<StarboardConfigType, 'guildId'>>} updates - Must already be validated
     * @returns {Promise<StarboardConfigType>}
     */
    async set(guildId, updates) {
        const stored = await StarboardConfig.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        const result = { ...starboardDefaults(guildId), ...stored };
        this.cache.set(guildId, result);
        return /** @type {StarboardConfigType} */ (result);
    }

    /** @param {string} guildId */
    async reset(guildId) {
        await StarboardConfig.deleteMany({ guildId });
        const result = starboardDefaults(guildId);
        this.cache.set(guildId, result);
        return result;
    }
}

export default new StarboardConfigCache();
