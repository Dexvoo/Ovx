import NodeCache from 'node-cache';
import { ModerationConfig } from '../models/moderationConfig.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/moderationConfig.js').ModerationConfigType} ModerationConfigType
 */

class ModerationConfigCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * A server's moderation settings, using the cache if available.
     * On a database error no automatic actions run (better than punishing someone by mistake).
     * @param {string} guildId
     * @returns {Promise<ModerationConfigType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {ModerationConfigType} */ (cached);

        try {
            const config = /** @type {ModerationConfigType | null} */ (
                await ModerationConfig.findOne({ guildId }).lean()
            );
            const result = config ?? this.createDefault(guildId);
            this.cache.set(guildId, result);
            return result;
        } catch (error) {
            LogData('Moderation Cache', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return this.createDefault(guildId);
        }
    }

    /**
     * Saves settings and refreshes the cache.
     * @param {string} guildId
     * @param {Partial<Omit<ModerationConfigType, 'guildId'>>} updates - Must already be validated
     * @returns {Promise<ModerationConfigType>}
     */
    async set(guildId, updates) {
        const config = await ModerationConfig.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        this.cache.set(guildId, config);
        return /** @type {ModerationConfigType} */ (config);
    }

    /**
     * @param {string} guildId
     * @returns {ModerationConfigType}
     */
    createDefault(guildId) {
        return { guildId, warnActions: [] };
    }
}

export default new ModerationConfigCache();
