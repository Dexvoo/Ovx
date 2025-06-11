const { TicketConfig, TicketConfigType } = require('../models/GuildSetups');
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
            console.log(`[TicketsCache] HIT: ${guildId}`);
            return this.cache.get(guildId);
        }

        let config = await TicketConfig.findOne({ guildId }).lean();

        if (!config) {
            console.log(`[TicketsCache] MISS & INIT: ${guildId}`);
            config = {
                guildId,
                enabled: false,
            };
        } else {
            console.log(`[TicketsCache] MISS & FOUND: ${guildId}`);
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