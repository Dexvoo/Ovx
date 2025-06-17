const { LevelConfig, LevelConfigType } = require('../models/GuildSetups');
const { consoleLogData } = require('../utils/LoggingData')
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
            consoleLogData(`LevelsCache`, `HIT: ${guildId}`, 'info');
            return this.cache.get(guildId);
        }

        let config = await LevelConfig.findOne({ guildId }).lean();

        if (!config) {
            consoleLogData(`LevelsCache`, `MISS & INIT: ${guildId}`, 'info');
            config = {
                guildId,
                enabled: false,
                channelId: null,
                blacklisted: { roleIds: [], channelIds: [] },
                rewards: [],
                removePastRewards: false,
                xpMultiplier: 1,
                messageCooldown: 60,
                maxLevel: 100,
                levelUpMessage: '{user}, you just gained a level! Current Level: **{level}**!',
                roleMultipliers: []
            };
        } else {
            consoleLogData(`LevelsCache`, `MISS & FOUND: ${guildId}`, 'info');
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