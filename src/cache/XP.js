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
     * Get top users by a stat type (e.g., messages, voicetime, levels, xp).
     * @param {string} guildId 
     * @param {'xp' | 'messages' | 'voicetime' | 'level'} type 
     * @param {OvxClient} client 
     * @returns {Promise<UserLevelsType[]>}
     */
    async getTopUsers(guildId, type, client) {
        const limit = 15;
        const allKeys = this.cache.keys().filter(key => key.startsWith(`${guildId}:`));
    
        const users = allKeys
            .map(key => this.cache.get(key))
            .filter(user => {
                if (!user) return false;
                if (type === 'level') return typeof user.level === 'number' && typeof user.xp === 'number';
                return typeof user[type] === 'number';
            });
        
        if (users.length >= limit) {
            const sorted = [...users].sort((a, b) => {
                if (type === 'level') {
                    return (b.level ?? 0) - (a.level ?? 0) || (b.xp ?? 0) - (a.xp ?? 0);
                } else {
                    return (b[type] ?? 0) - (a[type] ?? 0);
                }
            });
            return sorted.slice(0, limit);
        }
    
        // Fallback to DB
        const sortQuery = type === 'level'
            ? { level: -1, xp: -1 }
            : { [type]: -1 };
    
        const topFromDB = await UserLevels
            .find({ guildId })
            .sort(sortQuery)
            .limit(limit)
            .lean();
    
        for (const user of topFromDB) {
            const key = `${guildId}:${user.userId}`;
            this.cache.set(key, user);
        }
    
        return topFromDB;
    }
}

module.exports = new XPCache();