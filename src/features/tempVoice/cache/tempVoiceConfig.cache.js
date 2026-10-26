import NodeCache from 'node-cache';
import { TempVoiceConfig } from '../models/tempVoice.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/tempVoice.js').TempVoiceConfigType} TempVoiceConfigType
 */

/** @param {string} guildId @returns {TempVoiceConfigType} */
export const tempVoiceDefaults = (guildId) => ({ guildId, enabled: false, hubs: [] });

class TempVoiceConfigCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * Read on every voice join and leave, so it stays cached. A database error counts as off.
     * @param {string} guildId
     * @returns {Promise<TempVoiceConfigType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {TempVoiceConfigType} */ (cached);
        try {
            const stored = await TempVoiceConfig.findOne({ guildId }).lean();
            const result = { ...tempVoiceDefaults(guildId), ...(stored ?? {}) };
            this.cache.set(guildId, result);
            return /** @type {TempVoiceConfigType} */ (result);
        } catch (error) {
            LogData('Temp Voice', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return tempVoiceDefaults(guildId);
        }
    }

    /**
     * @param {string} guildId
     * @param {Partial<Omit<TempVoiceConfigType, 'guildId'>>} updates - Must already be validated
     * @returns {Promise<TempVoiceConfigType>}
     */
    async set(guildId, updates) {
        const stored = await TempVoiceConfig.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        const result = { ...tempVoiceDefaults(guildId), ...stored };
        this.cache.set(guildId, result);
        return /** @type {TempVoiceConfigType} */ (result);
    }

    /** @param {string} guildId */
    async reset(guildId) {
        await TempVoiceConfig.deleteMany({ guildId });
        const result = tempVoiceDefaults(guildId);
        this.cache.set(guildId, result);
        return result;
    }
}

export default new TempVoiceConfigCache();
