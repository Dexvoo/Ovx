import NodeCache from 'node-cache';
import { AutomodConfig, withAutomodDefaults } from '../models/automodConfig.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/automodConfig.js').AutomodConfigType} AutomodConfigType
 */

class AutomodConfigCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * Read on every member join (anti-raid), so it stays cached. A database error counts as everything off.
     * @param {string} guildId
     * @returns {Promise<AutomodConfigType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {AutomodConfigType} */ (cached);
        try {
            const result = withAutomodDefaults(guildId, await AutomodConfig.findOne({ guildId }).lean());
            this.cache.set(guildId, result);
            return result;
        } catch (error) {
            LogData('AutoMod', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return withAutomodDefaults(guildId);
        }
    }

    /**
     * @param {string} guildId
     * @param {Partial<Omit<AutomodConfigType, 'guildId'>>} updates - Must already be validated
     * @returns {Promise<AutomodConfigType>}
     */
    async set(guildId, updates) {
        const stored = await AutomodConfig.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true }
        );
        const result = withAutomodDefaults(guildId, stored);
        this.cache.set(guildId, result);
        return result;
    }
}

export default new AutomodConfigCache();
