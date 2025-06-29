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
        await LogsConfig.updateOne({ guildId }, newData, { upsert: true });
        this.cache.set(guildId, newData);
    }


    /**
     * Update logs config for a guild and update the cache.
     * @param {string} guildId
     * @param {keyof LogsConfigType} type
     * @param {Partial<LogsConfigType[keyof LogsConfigType]>} newData
     * @returns {Promise<void>}
     */
    async setType(guildId, type, newData) {
        const config = await this.get(guildId);
        if (!config) {
            LogData(`LogCache`, `No config found for guild: ${guildId}`, 'info');
            return false;
        }

        config[type] = newData;
        await this.set(guildId, config);
        await LogsConfig.updateOne({ guildId }, { [type]: newData });
        this.cache.set(guildId, config);

        return true
    }

    /**
     * Update logs config for a guild and update the cache.
     * @param {string} guildId
     * @param {keyof LogsConfigType} type
     */
    async deleteType(guildId, type) {
        const config = await this.get(guildId);
        if(!config || !config[type]) return false;

        delete config[type];
        await this.set(guildId, config);
        await LogsConfig.updateOne({ guildId }, { $unset: { [type]: "" } });
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