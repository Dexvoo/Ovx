import NodeCache from 'node-cache';
import { AutoRoles } from '../models/autoRoles.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/autoRoles.js').AutoRolesType} AutoRolesType
 */

class AutoRolesCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * The auto roles for a guild, using the cache if available.
     * On a database error nothing is given out (better than giving the wrong roles).
     * @param {string} guildId
     * @returns {Promise<AutoRolesType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {AutoRolesType} */ (cached);

        try {
            const config = /** @type {AutoRolesType | null} */ (await AutoRoles.findOne({ guildId }).lean());
            const result = config ?? this.createDefault(guildId);
            this.cache.set(guildId, result);
            return result;
        } catch (error) {
            LogData('Auto Roles Cache', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return this.createDefault(guildId);
        }
    }

    /**
     * Saves some settings and refreshes the cache.
     * @param {string} guildId
     * @param {Partial<Omit<AutoRolesType, 'guildId'>>} updates - Must already be validated
     * @returns {Promise<AutoRolesType>}
     */
    async set(guildId, updates) {
        const config = await AutoRoles.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        this.cache.set(guildId, config);
        return /** @type {AutoRolesType} */ (config);
    }

    /**
     * @param {string} guildId
     * @returns {AutoRolesType}
     */
    createDefault(guildId) {
        return { guildId, enabled: false, humanRoleIds: [], botRoleIds: [] };
    }
}

export default new AutoRolesCache();
