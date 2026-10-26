import NodeCache from 'node-cache';
import { HoneypotConfig, withHoneypotDefaults } from '../models/honeypotConfig.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/honeypotConfig.js').HoneypotConfigType} HoneypotConfigType
 */

class HoneypotConfigCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * A server's honeypot settings, using the cache if available. Read on every message, so it must stay cached.
     * On a database error it's treated as off (better than banning someone by mistake).
     * @param {string} guildId
     * @returns {Promise<HoneypotConfigType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {HoneypotConfigType} */ (cached);

        try {
            const stored = await HoneypotConfig.findOne({ guildId }).lean();
            const result = withHoneypotDefaults(guildId, /** @type {any} */ (stored));
            this.cache.set(guildId, result);
            return result;
        } catch (error) {
            LogData('Honeypot', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return withHoneypotDefaults(guildId);
        }
    }

    /**
     * Saves settings and refreshes the cache.
     * @param {string} guildId
     * @param {Partial<Omit<HoneypotConfigType, 'guildId'>>} updates - Must already be validated
     * @returns {Promise<HoneypotConfigType>}
     */
    async set(guildId, updates) {
        const stored = await HoneypotConfig.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        const result = withHoneypotDefaults(guildId, /** @type {any} */ (stored));
        this.cache.set(guildId, result);
        return result;
    }

    /**
     * Deletes the settings (a reset), so the defaults apply.
     * @param {string} guildId
     */
    async reset(guildId) {
        await HoneypotConfig.deleteMany({ guildId });
        const result = withHoneypotDefaults(guildId);
        this.cache.set(guildId, result);
        return result;
    }
}

export default new HoneypotConfigCache();
