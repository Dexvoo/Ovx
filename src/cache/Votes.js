const NodeCache = require('node-cache');
const { VoteType, UserVotes } = require('../models/UserSetups'); // Adjust path to your Vote model file
const { LogData } = require('../utils/Functions/ConsoleLogs'); // Adjust path to your logging utility

class VoteCache {
	constructor() {
		this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 120 }); // 1h TTL
	}

	/**
	 * Get vote data for a user.
	 * Fetches from cache if available, otherwise from the database.
	 * Creates a new vote document if one doesn't exist for the user.
	 * @param {string} userId - The ID of the user.
	 * @returns {Promise<VoteType>}
	 */
	async get(userId) {
        if (this.cache.has(userId)) {
            LogData(`VoteCache`, `HIT: ${userId}`, 'info');
            return this.cache.get(userId);
        }

        let voteData = await UserVotes.findOne({ userId }).lean();

        if (!voteData) {
            LogData(`VoteCache`, `MISS & INIT: ${userId}`, 'info');
            voteData = (await UserVotes.create({ userId })).toObject();
        } else {
            LogData(`VoteCache`, `MISS & FOUND: ${userId}`, 'info');
        }

        this.cache.set(userId, voteData);
        return voteData;
    }

	/**
	 * Directly set (or update) vote data.
	 * This updates the database and invalidates the cache entry.
	 * @param {string} userId - The ID of the user.
	 * @param {Partial<VoteType>} data - The data to set.
	 */
	async set(userId, data) {
		await UserVotes.updateOne({ userId }, { $set: data }, { upsert: true });
		this.cache.del(userId); // Invalidate cache to ensure next `get` fetches fresh data
        LogData(`VoteCache`, `SET & INVALIDATE: ${userId}`, 'info');
	}

    /**
	 * A helper method to increment the vote count for a user.
     * This is more efficient than get -> modify -> set.
	 * It updates the database and invalidates the cache entry.
	 * @param {string} userId - The ID of the user.
	 * @param {number} [amount=1] - The number of votes to add.
	 */
    async incrementVotes(userId, amount = 1) {
        await UserVotes.updateOne({ userId }, { $inc: { votes: amount } }, { upsert: true });
        this.cache.del(userId); // Invalidate cache
        LogData(`VoteCache`, `INCREMENT & INVALIDATE: ${userId}`, 'info');
    }

	/**
	 * Manually invalidate a user's cache entry.
	 * @param {string} userId - The ID of the user whose cache to invalidate.
	 */
	invalidate(userId) {
		this.cache.del(userId);
        LogData(`VoteCache`, `MANUAL INVALIDATE: ${userId}`, 'info');
	}
}

module.exports = new VoteCache();