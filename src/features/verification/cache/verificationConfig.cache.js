import NodeCache from 'node-cache';
import { VerificationConfig, verificationDefaults } from '../models/verification.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/verification.js').VerificationConfigType} VerificationConfigType
 */

class VerificationConfigCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * Read on every member join, so it stays cached. A database error counts as off.
     * @param {string} guildId
     * @returns {Promise<VerificationConfigType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {VerificationConfigType} */ (cached);
        try {
            const stored = await VerificationConfig.findOne({ guildId }).lean();
            const result = { ...verificationDefaults(guildId), ...(stored ?? {}) };
            this.cache.set(guildId, result);
            return /** @type {VerificationConfigType} */ (result);
        } catch (error) {
            LogData('Verification', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return verificationDefaults(guildId);
        }
    }

    /**
     * @param {string} guildId
     * @param {Partial<Omit<VerificationConfigType, 'guildId'>>} updates - Must already be validated
     * @returns {Promise<VerificationConfigType>}
     */
    async set(guildId, updates) {
        const stored = await VerificationConfig.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        const result = { ...verificationDefaults(guildId), ...stored };
        this.cache.set(guildId, result);
        return /** @type {VerificationConfigType} */ (result);
    }
}

export default new VerificationConfigCache();
