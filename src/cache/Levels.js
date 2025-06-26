const { LevelConfig, LevelConfigType } = require('../models/GuildSetups');
const { LogData } = require('../utils/Functions/ConsoleLogs')
const NodeCache = require('node-cache');

class LevelsCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });
    }

    /**
     * Get ticket config for a guild, using cache if available.
     * @param {string} guildId
     * @return {Promise<LevelConfigType>}
     */
    async get(guildId) {
        if (this.cache.has(guildId)) {
            LogData(`LevelsCache`, `HIT: ${guildId}`, 'info');
            return this.cache.get(guildId);
        }

        let config = await LevelConfig.findOne({ guildId }).lean();

        if (!config) {
            LogData(`LevelsCache`, `MISS & INIT: ${guildId}`, 'info');
            config = (await LevelConfig.create({ guildId})).toObject();
        } else {
            LogData(`LevelsCache`, `MISS & FOUND: ${guildId}`, 'info');
        }

        this.cache.set(guildId, config);
        return config;
    }

    /**
     * Update a specific key in the level config
     * @param {string} guildId
     * @param {keyof LevelConfigType} key
     * @param {*} value
     */
    async setType(guildId, key, value) {
        await LevelConfig.updateOne({ guildId }, { [key]: value }, { upsert: true });
        const config = await this.get(guildId);
        config[key] = value;
        this.cache.set(guildId, config);
    }
}

module.exports = new LevelsCache();