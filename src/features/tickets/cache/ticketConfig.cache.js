import NodeCache from 'node-cache';
import { TicketConfig } from '../models/ticketConfig.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/ticketConfig.js').TicketConfigType} TicketConfigType
 */

class TicketConfigCache {
    /**
     * @private
     * @type {NodeCache}
     */
    cache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 2 * 60 });
    }

    /**
     * The ticket settings for a guild, using the cache if available.
     * On a database error tickets are treated as off.
     * @param {string} guildId
     * @returns {Promise<TicketConfigType>}
     */
    async get(guildId) {
        const cached = this.cache.get(guildId);
        if (cached) return /** @type {TicketConfigType} */ (cached);

        try {
            const config = /** @type {TicketConfigType | null} */ (await TicketConfig.findOne({ guildId }).lean());
            const result = config ?? this.createDefault(guildId);
            this.cache.set(guildId, result);
            return result;
        } catch (error) {
            LogData('Ticket Config Cache', `Failed to get config for ${guildId}: ${error.message}`, 'error');
            return this.createDefault(guildId);
        }
    }

    /**
     * Saves some settings and refreshes the cache.
     * @param {string} guildId
     * @param {Record<string, any>} updates - Must already be validated; dotted keys like 'panel.messageId' work
     * @returns {Promise<TicketConfigType>}
     */
    async set(guildId, updates) {
        const config = await TicketConfig.findOneAndUpdate(
            { guildId },
            { $set: updates },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        this.cache.set(guildId, config);
        return /** @type {TicketConfigType} */ (config);
    }

    /**
     * The next ticket number. Atomic, so two tickets opened at once never share a number.
     * @param {string} guildId
     * @returns {Promise<number>}
     */
    async nextTicketNumber(guildId) {
        const config = await TicketConfig.findOneAndUpdate(
            { guildId },
            { $inc: { lastTicketNumber: 1 } },
            { returnDocument: 'after', upsert: true, lean: true, setDefaultsOnInsert: true }
        );
        this.cache.set(guildId, config);
        return /** @type {TicketConfigType} */ (config).lastTicketNumber;
    }

    /**
     * @param {string} guildId
     * @returns {TicketConfigType}
     */
    createDefault(guildId) {
        return {
            guildId,
            enabled: false,
            categoryId: null,
            transcriptChannelId: null,
            staffRoleIds: [],
            pingStaff: true,
            maxOpenPerUser: 1,
            ownerCanClose: true,
            dmTranscript: true,
            openMessage: null,
            panel: { channelId: null, messageId: null, title: null, description: null, buttonLabel: null },
            ticketTypes: [],
            lastTicketNumber: 0,
        };
    }
}

export default new TicketConfigCache();
