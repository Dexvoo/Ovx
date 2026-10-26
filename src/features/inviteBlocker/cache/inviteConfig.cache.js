import NodeCache from 'node-cache';
import { InviteConfig, withInviteDefaults } from '../models/inviteConfig.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/inviteConfig.js').InviteConfigType} InviteConfigType
 */

class InviteConfigCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * A server's invite blocker settings, using the cache if available. Read on every message, so it must stay cached.
     * On a database error it's treated as off (better than deleting messages by mistake).
     * @param {string} guildId
     * @returns {Promise<InviteConfigType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {InviteConfigType} */ (cached);

        try {
            const stored = await InviteConfig.findOne({ guildId }).lean();
            const result = withInviteDefaults(guildId, /** @type {any} */ (stored));
            this.cache.set(guildId, result);
            return result;
        } catch (error) {
            LogData('Invite Blocker', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return withInviteDefaults(guildId);
        }
    }

    /**
     * Saves settings and refreshes the cache.
     * @param {string} guildId
     * @param {Partial<Omit<InviteConfigType, 'guildId'>>} updates - Must already be validated
     * @returns {Promise<InviteConfigType>}
     */
    async set(guildId, updates) {
        const stored = await InviteConfig.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        const result = withInviteDefaults(guildId, /** @type {any} */ (stored));
        this.cache.set(guildId, result);
        return result;
    }

    /**
     * Deletes the settings (a reset), so the defaults apply.
     * @param {string} guildId
     */
    async reset(guildId) {
        await InviteConfig.deleteMany({ guildId });
        const result = withInviteDefaults(guildId);
        this.cache.set(guildId, result);
        return result;
    }
}

export default new InviteConfigCache();
