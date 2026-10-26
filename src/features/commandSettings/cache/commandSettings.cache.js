import NodeCache from 'node-cache';
import { CommandSettings, commandSettingsDefaults } from '../models/commandSettings.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/commandSettings.js').CommandSettingsType} CommandSettingsType
 */

class CommandSettingsCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * Read before every command, so it stays cached. A database error allows everything (better than
     * blocking every command because of a hiccup).
     * @param {string} guildId
     * @returns {Promise<CommandSettingsType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {CommandSettingsType} */ (cached);
        try {
            const stored = await CommandSettings.findOne({ guildId }).lean();
            const result = { ...commandSettingsDefaults(guildId), ...(stored ?? {}) };
            this.cache.set(guildId, result);
            return /** @type {CommandSettingsType} */ (result);
        } catch (error) {
            LogData('Commands', `Failed to get command settings for ${guildId}: ${error.message}`, 'error');
            return commandSettingsDefaults(guildId);
        }
    }

    /**
     * @param {string} guildId
     * @param {Partial<Omit<CommandSettingsType, 'guildId'>>} updates - Must already be validated
     * @returns {Promise<CommandSettingsType>}
     */
    async set(guildId, updates) {
        const stored = await CommandSettings.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        const result = { ...commandSettingsDefaults(guildId), ...stored };
        this.cache.set(guildId, result);
        return /** @type {CommandSettingsType} */ (result);
    }

    /** @param {string} guildId */
    async reset(guildId) {
        await CommandSettings.deleteMany({ guildId });
        const result = commandSettingsDefaults(guildId);
        this.cache.set(guildId, result);
        return result;
    }
}

export default new CommandSettingsCache();
