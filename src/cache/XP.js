const NodeCache = require('node-cache');
const { UserLevels, UserLevelsType } = require('../models/UserSetups'); // Adjust path if needed
const OvxClient = require('../structures/OvxClient')
const { LogData } = require('../utils/Functions/ConsoleLogs')

class XPCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });
    }

    /**
     * Get a user's XP data from cache or DB.
     * @param {string} guildId 
     * @param {string} userId 
     * @returns {Promise<UserLevelsType>}
     */
    async get(guildId, userId) {
        const key = `${guildId}:${userId}`;
        const cached = this.cache.get(key);
        
        if (cached) {
            LogData(`XPCache`, `HIT: ${guildId}`, 'info');
            return cached;
        }

        let userData = await UserLevels.findOne({ guildId, userId }).lean();
        if (!userData) {
            LogData(`XPCache`, `MISS & INIT: ${guildId}`, 'info');
            userData = (await UserLevels.create({ guildId, userId })).toObject();
        } else {
            LogData(`XPCache`, `MISS & FOUND: ${guildId}`, 'info');
        }

        this.cache.set(key, userData);
        return userData;
    }

    /**
     * Sets user XP data — updates both DB and cache.
     * @param {string} guildId 
     * @param {string} userId 
     * @param {Partial<UserLevelsType} newData 
     * @returns {Promise<void>}
     */
    async set(guildId, userId, newData) {
        const key = `${guildId}:${userId}`;
        
        // Update DB
        await UserLevels.updateOne(
            { guildId, userId },
            { $set: newData },
            { upsert: true }
        );

        // Update cache
        const existing = this.cache.get(key) || { guildId, userId };
        this.cache.set(key, { ...existing, ...newData });
    }

    /**
     * Invalidate a user's cache entry (force refetch on next get).
     * @param {string} guildId 
     * @param {string} userId 
     */
    invalidate(guildId, userId) {
        this.cache.del(`${guildId}:${userId}`);
    }

    /**
     * Delete all cache entries for a given guild (e.g. on leave).
     * @param {string} guildId 
     */
    clearGuild(guildId) {
        const keys = this.cache.keys().filter(key => key.startsWith(`${guildId}:`));
        this.cache.del(keys);
    }


     /**
     * Get top users by a stat type, ensuring data freshness.
     * This method prioritizes DB accuracy and updates the cache.
     * @param {string} guildId 
     * @param {'totalMessages' | 'totalVoice' | 'level'} type 
     * @returns {Promise<UserLevelsType[]>}
     */
    async getTopUsers(guildId, type) {
        const limit = 15;
    
        const sortQuery = type === 'level'
            ? { level: -1, xp: -1 } // Sort by level, then by XP within the level
            : { [type]: -1 };
    
        try {
            const topFromDB = await UserLevels
                .find({ guildId, [type]: { $gt: 0 } }) // Ensure we only get users who have a value for the stat
                .sort(sortQuery)
                .limit(limit)
                .lean();
    
            // Update the cache with the fresh data from the database
            for (const user of topFromDB) {
                const key = `${guildId}:${user.userId}`;
                this.cache.set(key, user);
            }
            
            LogData(`XPCache`, `Leaderboard REFRESH: ${guildId} by ${type}`, 'info');
            return topFromDB;

        } catch (error) {
            console.error(`Failed to fetch leaderboard from DB for guild ${guildId}:`, error);
            return []; // Return an empty array on error
        }
    }
}

module.exports = new XPCache();