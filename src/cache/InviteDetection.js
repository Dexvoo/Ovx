const NodeCache = require('node-cache');
const { InviteDetectionType, InviteDetectionConfig } = require('../models/GuildSetups'); // adjust path if needed
const { LogData } =  require('../utils/Functions/ConsoleLogs')

class InviteDetectionCache {
	constructor() {
		this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 120 }); // 1h TTL
	}

	/**
	 * Get invite detection config for a guild
	 * @param {string} guildId
	 * @returns {Promise<InviteDetectionType>}
	 */
	async get(guildId) {
        if (this.cache.has(guildId)) {
            LogData(`InviteDetectionCache`, `HIT: ${guildId}`, 'info');
            return this.cache.get(guildId);
        }

        let config = await InviteDetectionConfig.findOne({ guildId }).lean();

        if (!config) {
            LogData(`InviteDetectionCache`, `MISS & INIT: ${guildId}`, 'info');
            config = (await InviteDetectionConfig.create({ guildId })).toObject();
        } else {
            LogData(`InviteDetectionCache`, `MISS & FOUND: ${guildId}`, 'info');
        }

        this.cache.set(guildId, config);
        return config;
    }

	/**
	 * Set (or update) the cache entry for a guild
	 * @param {string} guildId
	 * @param {InviteDetectionType} data
	 */
	async set(guildId, data) {
		await InviteDetectionConfig.updateOne({guildId}, {enabled: data.enabled})
		this.cache.set(guildId, data);
	}

	/**
	 * Invalidate a guild's cache entry
	 * @param {string} guildId
	 */
	invalidate(guildId) {
		this.cache.del(guildId);
	}
}

module.exports = new InviteDetectionCache();
