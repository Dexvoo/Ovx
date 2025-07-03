const { LogsConfig, LogsConfigType } = require('../models/GuildSetups');
const { LogData } = require('../utils/Functions/ConsoleLogs')
const NodeCache = require('node-cache');

class LogCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });
    }

    /**
     * Get logs config for a guild, using cache if available.
     * @param {string} guildId
     * @return {Promise<LogsConfigType>}
     */
    async get(guildId) {
        if (this.cache.has(guildId)) {
            LogData(`LogCache`, `HIT: ${guildId}`, 'info');
            return this.cache.get(guildId);
        }

        let config = await LogsConfig.findOne({ guildId }).lean();

        if (!config) {
            LogData(`LogCache`, `MISS & INIT: ${guildId}`, 'info');
            config = { guildId, enabled: false };
        } else {
            LogData(`LogCache`, `MISS & FOUND: ${guildId}`, 'info');
        }

        this.cache.set(guildId, config);
        return config;
    }


    /**
     * Update logs config for a guild and update the cache.
     * @param {string} guildId
     * @param {Partial<LogsConfigType>} newData
     * @returns {Promise<void>}
     */
    async set(guildId, newData) {
        await LogsConfig.updateOne({ guildId }, { $set: newData }, { upsert: true });
        this.cache.del(guildId);
    }


    /**
     * Update logs config for a guild and update the cache.
     * @param {string} guildId
     * @param {keyof LogsConfigType} type
     * @param {Partial<LogsConfigType[keyof LogsConfigType]>} newData
     * @returns {Promise<boolean>}
     */
    async setType(guildId, type, newData) {
        await LogsConfig.updateOne({ guildId }, { $set: { [type]: newData } }, { upsert: true });
        this.cache.del(guildId);
        return true;
    }

    /**
     * Update logs config for a guild and update the cache.
     * @param {string} guildId
     * @param {keyof LogsConfigType} type
     */
    async deleteType(guildId, type) {
        const { matchedCount } = await LogsConfig.updateOne({ guildId }, { $unset: { [type]: "" } });
        if (matchedCount > 0) {
            this.cache.del(guildId);
        }
    }


    /**
     * Invalidate the cache for a specific guild.
     * @param {string} guildId
     */
    invalidate(guildId) {
        this.cache.del(guildId);
    }
}

module.exports = new LogCache();