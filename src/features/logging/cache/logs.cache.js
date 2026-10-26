import { LogsConfig } from '../models/logging.js';
import NodeCache from 'node-cache';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/logging.js').LogsConfigType} LogsConfigType
 * @typedef {import('../models/logging.js').LogsType} LogsType
 * @typedef {import('../models/logging.js').LogType} LogType
 */
class LogsCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        // stdTTL: 3600 (1 hour), checkperiod: 120 (cleans up expired keys every 2 mins)
        this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });
    }

    /**
     * Fetches the log configuration for a guild, using the cache if available.
     * @param {string} guildId - The ID of the guild.
     * @return {Promise<LogsConfigType>} The log configuration.
     */
    async get(guildId) {
        try {
            if (this.cache.has(guildId)) {
                return this.cache.get(guildId);
            }

            let config = /** @type {LogsConfigType | null} */ (await LogsConfig.findOne({ guildId }).lean());

            if (!config) {
                // If it doesn't exist, we cache a default state so we don't spam the DB
                config = { guildId };
            }

            this.cache.set(guildId, config);
            return config;
        } catch (error) {
            LogData('LogsCache', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return { guildId };
        }
    }

    /**
     * Updates the main logs config and instantly updates the cache.
     * @param {string} guildId - The ID of the guild.
     * @param {Partial<LogsConfigType>} updates - The fields to update.
     * @return {Promise<LogsConfigType>} The updated log configuration.
     */
    async set(guildId, updates) {
        try {
            const updatedConfig = await LogsConfig.findOneAndUpdate(
                { guildId },
                { $set: updates },
                { returnDocument: 'after', upsert: true, lean: true }
            );

            this.cache.set(guildId, updatedConfig);
            LogData('LogsCache', `Config updated for guild ${guildId}`, 'debug');

            return /** @type {LogsConfigType} */ (updatedConfig);
        } catch (error) {
            LogData('LogsCache', `Failed to set config for ${guildId}: ${error.message}`, 'error');
            throw error; // Re-throw so the command handler knows it failed
        }
    }

    /**
     * Updates a specific sub-category (like 'message', 'join', 'leave') and updates cache.
     * @param {string} guildId
     * @param {LogType} type
     * @param {Partial<LogsType>} newData - The new data for this category.
     * @return {Promise<LogsConfigType>}
     */
    async setType(guildId, type, newData) {
        try {
            const updatedConfig = await LogsConfig.findOneAndUpdate(
                { guildId },
                { $set: { [type]: newData } },
                { returnDocument: 'after', upsert: true, lean: true }
            );

            this.cache.set(guildId, updatedConfig);
            LogData('LogsCache', `Type '${type}' updated for guild ${guildId}`, 'debug');

            return /** @type {LogsConfigType} */ (updatedConfig);
        } catch (error) {
            LogData('LogsCache', `Failed to set type '${type}' for ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Deletes/unsets a specific log category from the DB and updates the cache.
     * @param {string} guildId
     * @param {LogType} type
     * @returns {Promise<LogsConfigType | null>}
     */
    async deleteType(guildId, type) {
        try {
            const updatedConfig = await LogsConfig.findOneAndUpdate(
                { guildId },
                { $unset: { [type]: '' } },
                { returnDocument: 'after', lean: true }
            );

            if (updatedConfig) {
                this.cache.set(guildId, updatedConfig);
            } else {
                this.cache.del(guildId);
            }

            LogData('LogsCache', `Type '${type}' deleted for guild ${guildId}`, 'debug');
            return /** @type {LogsConfigType | null} */ (updatedConfig);
        } catch (error) {
            LogData('LogsCache', `Failed to delete type '${type}' for ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Forcefully removes a guild from the cache.
     * @param {string} guildId
     */
    invalidate(guildId) {
        this.cache.del(guildId);
        LogData('LogsCache', `Cache invalidated for guild ${guildId}`, 'debug');
    }
}

export default new LogsCache();
