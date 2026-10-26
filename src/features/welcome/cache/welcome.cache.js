import NodeCache from 'node-cache';
import { Welcome } from '../models/welcome.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/welcome.js').WelcomeType} WelcomeType
 * @typedef {import('../models/welcome.js').WelcomeMessageType} WelcomeMessageType
 */

class WelcomeCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * The welcome and goodbye settings for a guild, using the cache if available.
     * On a database error both are treated as off.
     * @param {string} guildId
     * @returns {Promise<WelcomeType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {WelcomeType} */ (cached);

        try {
            const config = /** @type {WelcomeType | null} */ (await Welcome.findOne({ guildId }).lean());
            const result = config ?? this.createDefault(guildId);
            this.cache.set(guildId, result);
            return result;
        } catch (error) {
            LogData('Welcome Cache', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return this.createDefault(guildId);
        }
    }

    /**
     * Saves one or both messages (each replaced as a whole) and refreshes the cache.
     * @param {string} guildId
     * @param {Partial<Pick<WelcomeType, 'welcome' | 'goodbye'>>} updates - Must already be validated
     * @returns {Promise<WelcomeType>}
     */
    async set(guildId, updates) {
        const config = await Welcome.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        this.cache.set(guildId, config);
        return /** @type {WelcomeType} */ (config);
    }

    /** @returns {WelcomeMessageType} */
    defaultMessage() {
        return { enabled: false, channelId: null, message: null, embed: false, title: null };
    }

    /**
     * @param {string} guildId
     * @returns {WelcomeType}
     */
    createDefault(guildId) {
        return { guildId, welcome: this.defaultMessage(), goodbye: this.defaultMessage() };
    }
}

export default new WelcomeCache();
