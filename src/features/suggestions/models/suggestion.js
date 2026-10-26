import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const SUGGESTION_STATUSES = Object.freeze(['pending', 'considering', 'approved', 'denied', 'implemented']);
/** Decided suggestions: voting is closed. */
export const CLOSED_STATUSES = Object.freeze(['approved', 'denied', 'implemented']);

/**
 * A member's suggestion, posted in the suggestions channel.
 *
 * @typedef {Object} SuggestionType
 * @property {import('mongoose').Types.ObjectId} _id
 * @property {string} guildId
 * @property {number} number - #1, #2... per server
 * @property {string} authorId
 * @property {string} content
 * @property {string | null} [imageUrl]
 * @property {string} channelId
 * @property {string | null} [messageId]
 * @property {string | null} [threadId]
 * @property {string} status - One of SUGGESTION_STATUSES
 * @property {string | null} [reason] - Why it was decided this way
 * @property {string | null} [decidedBy]
 * @property {Date | null} [decidedAt]
 * @property {string[]} upvoters
 * @property {string[]} downvoters
 * @property {Date} createdAt
 */

const SuggestionSchema = new Schema({
    guildId: { type: String, required: true },
    number: { type: Number, required: true },
    authorId: { type: String, required: true },
    content: { type: String, required: true },
    imageUrl: { type: String, default: null },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    threadId: { type: String, default: null },
    status: { type: String, enum: SUGGESTION_STATUSES, default: 'pending' },
    reason: { type: String, default: null },
    decidedBy: { type: String, default: null },
    decidedAt: { type: Date, default: null },
    upvoters: { type: [String], default: [] },
    downvoters: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
});

SuggestionSchema.index({ guildId: 1, number: -1 }, { unique: true });
SuggestionSchema.index({ guildId: 1, authorId: 1, createdAt: -1 });

export const Suggestion = model('Guild-Suggestion', SuggestionSchema);

/** The last suggestion number used in each server, so numbers are never reused. */
const SuggestionCounterSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    last: { type: Number, default: 0 },
});

export const SuggestionCounter = model('Guild-Suggestion-Counter', SuggestionCounterSchema);

/**
 * Suggestion settings (the dashboard's Suggestions page).
 *
 * @typedef {Object} SuggestionConfigType
 * @property {string} guildId
 * @property {boolean} enabled
 * @property {string | null} channelId
 * @property {boolean} threads - Open a discussion thread on each suggestion
 * @property {boolean} dmAuthor - DM the author when it's decided
 * @property {number} cooldownMinutes - Between one member's suggestions
 * @property {string[]} managerRoleIds - Can decide suggestions without Manage Server
 */

const SuggestionConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    threads: { type: Boolean, default: true },
    dmAuthor: { type: Boolean, default: true },
    cooldownMinutes: { type: Number, default: 5 },
    managerRoleIds: { type: [String], default: [] },
});

export const SuggestionConfig = model('Guild-Suggestion-Config', SuggestionConfigSchema);

/** @param {string} guildId @returns {SuggestionConfigType} */
export const suggestionDefaults = (guildId) => ({
    guildId,
    enabled: false,
    channelId: null,
    threads: true,
    dmAuthor: true,
    cooldownMinutes: 5,
    managerRoleIds: [],
});
