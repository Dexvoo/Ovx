const { TicketConfig, TicketConfigType } = require('../models/GuildSetups');
const { LogData } = require('../utils/Functions/ConsoleLogs')
const NodeCache = require('node-cache');

class TicketsCache {
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
     * @return {Promise<TicketConfigType>}
     */
    async get(guildId) {
        if (this.cache.has(guildId)) {
            LogData(`TicketsCache`, `HIT: ${guildId}`, 'info');
            return this.cache.get(guildId);
        }

        let config = await TicketConfig.findOne({ guildId }).lean();

        if (!config) {
            LogData(`TicketsCache`, `MISS & INIT: ${guildId}`, 'info');
            config = {
                guildId,
                enabled: false,
            };
        } else {
            LogData(`TicketsCache`, `MISS & FOUND: ${guildId}`, 'info');
        }

        this.cache.set(guildId, config);
        return config;
    }

    /**
     * Update ticket config for a guild and update the cache.
     * @param {string} guildId
     * @param {Partial<TicketConfigType>} newData
     * @returns {Promise<void>}
     */
    async set(guildId, newData) {
        await TicketConfig.updateOne({ guildId }, newData, { upsert: true });
        this.cache.set(guildId, newData);
    }
}

module.exports = new TicketsCache();