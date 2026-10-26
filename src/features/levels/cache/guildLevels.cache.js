import { LevelConfig } from '../models/guildLevels.js';
import NodeCache from 'node-cache';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/guildLevels.js').GuildLevelsType} GuildLevelsType
 */
class Guild_Level_Cache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 1 * 60 * 60, checkperiod: 1 * 60 * 2 });
    }

    /**
     * Fetches the log configuration for a guild, using the cache if available.
     * @param {string} guildId - The ID of the guild.
     * @return {Promise<GuildLevelsType>} The log configuration.
     */
    async get(guildId) {
        try {
            const cached = this.cache.get(guildId);
            if (cached) return cached;

            let config = /** @type {GuildLevelsType | null} */ (await LevelConfig.findOne({ guildId }).lean());

            if (!config) {
                config = this.createDefault(guildId);
            }

            this.cache.set(guildId, config);
            return config;
        } catch (error) {
            LogData('Guild Level Cache', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return this.createDefault(guildId);
        }
    }

    /**
     * Updates a specific sub-category (like 'message', 'join', 'leave') and updates cache.
     * @param {string} guildId
     * @param {keyof GuildLevelsType} type
     * @param {Partial<GuildLevelsType[keyof GuildLevelsType]>} newData - The new data for this category.
     * @return {Promise<GuildLevelsType>}
     */
    async setType(guildId, type, newData) {
        try {
            const updateData =
                typeof newData === 'object' && newData !== null && !Array.isArray(newData)
                    ? Object.fromEntries(Object.entries(newData).map(([key, value]) => [`${type}.${key}`, value]))
                    : { [type]: newData };

            const updatedConfig = await LevelConfig.findOneAndUpdate(
                { guildId },
                { $set: updateData },
                {
                    returnDocument: 'after',
                    upsert: true,
                    lean: true,
                    setDefaultsOnInsert: true,
                }
            );

            this.cache.set(guildId, updatedConfig);

            LogData('Guild Level Cache', `Type '${type}' updated for guild ${guildId}`, 'debug');

            return /** @type {GuildLevelsType} */ (updatedConfig);
        } catch (error) {
            LogData('Guild Level Cache', `Failed to set type '${type}' for ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Sets several top-level fields in one atomic update and refreshes the cache.
     * @param {string} guildId
     * @param {Partial<GuildLevelsType>} updates - Must already be validated; keys are written as-is
     * @return {Promise<GuildLevelsType>}
     */
    async set(guildId, updates) {
        try {
            const updatedConfig = await LevelConfig.findOneAndUpdate(
                { guildId },
                { $set: updates },
                { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
            );

            this.cache.set(guildId, updatedConfig);
            LogData('Guild Level Cache', `Config updated for guild ${guildId}`, 'debug');

            return /** @type {GuildLevelsType} */ (updatedConfig);
        } catch (error) {
            LogData('Guild Level Cache', `Failed to update config for ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    createDefault(guildId) {
        return {
            guildId,

            enabled: false,
            channelId: null,

            blacklisted: {
                roleIds: [],
                channelIds: [],
            },

            rewards: [],
            removePastRewards: false,

            xpMultiplier: 1,
            messageCooldown: 60,
            maxLevel: 100,

            levelUpMessage: '{user}, you just gained a level! Current Level: **{level}**!',

            roleMultipliers: [],

            publicLeaderboard: false,
        };
    }

    /**
     * Forcefully removes a guild from the cache.
     * @param {string} guildId
     */
    invalidate(guildId) {
        this.cache.del(guildId);
        LogData('Guild Level Cache', `Cache invalidated for guild ${guildId}`, 'debug');
    }
}

export default new Guild_Level_Cache();
