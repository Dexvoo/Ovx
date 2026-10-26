import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const HONEYPOT_ACTIONS = /** @type {const} */ (['ban', 'softban']);
/** How much of the member's recent message history the ban deletes (Discord allows up to 7 days). */
export const HONEYPOT_DELETE_SECONDS = /** @type {const} */ ([0, 3600, 6 * 3600, 86400, 3 * 86400, 7 * 86400]);

/**
 * Honeypot channel settings (the dashboard's Honeypot page). A channel nobody should post in: compromised
 * accounts spamming every channel they can see post there too, and get removed.
 *
 * @typedef {Object} HoneypotConfigType
 * @property {string} guildId
 * @property {boolean} enabled
 * @property {string | null} channelId
 * @property {'ban' | 'softban'} action - softban: banned then unbanned at once, so their messages go but they can rejoin
 * @property {number} deleteMessageSeconds - One of HONEYPOT_DELETE_SECONDS
 * @property {boolean} notify - DM the member why
 */

const HoneypotConfigSchema = new Schema({
    guildId: { type: String, required: true, index: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    action: { type: String, enum: HONEYPOT_ACTIONS, default: 'ban' },
    deleteMessageSeconds: { type: Number, default: 3600 },
    notify: { type: Boolean, default: true },
});

export const HoneypotConfig = model('Guild-Honeypot-Config', HoneypotConfigSchema);

/**
 * @param {string} guildId
 * @param {Partial<HoneypotConfigType> | null} [stored]
 * @returns {HoneypotConfigType}
 */
export function withHoneypotDefaults(guildId, stored = null) {
    return {
        guildId,
        enabled: stored?.enabled ?? false,
        channelId: stored?.channelId ?? null,
        action: stored?.action ?? 'ban',
        deleteMessageSeconds: stored?.deleteMessageSeconds ?? 3600,
        notify: stored?.notify ?? true,
    };
}
