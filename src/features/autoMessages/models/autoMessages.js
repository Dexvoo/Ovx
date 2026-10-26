import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * A message posted on a repeat (the dashboard's Auto Messages page).
 *
 * @typedef {Object} AutoMessageType
 * @property {import('mongoose').Types.ObjectId} _id
 * @property {string} guildId
 * @property {string} channelId
 * @property {string} content
 * @property {number} intervalMinutes
 * @property {boolean} enabled
 * @property {boolean} skipIfQuiet - Skip a round if nobody posted since the last one
 * @property {Date} nextRunAt
 * @property {string | null} [lastMessageId] - The last one posted
 */

const AutoMessageSchema = new Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    content: { type: String, required: true },
    intervalMinutes: { type: Number, required: true },
    enabled: { type: Boolean, default: true },
    skipIfQuiet: { type: Boolean, default: true },
    nextRunAt: { type: Date, required: true },
    lastMessageId: { type: String, default: null },
});

AutoMessageSchema.index({ guildId: 1 });
AutoMessageSchema.index({ enabled: 1, nextRunAt: 1 });

export const AutoMessage = model('Guild-Auto-Message', AutoMessageSchema);

/**
 * A message kept at the bottom of a channel: reposted after people chat.
 *
 * @typedef {Object} StickyMessageType
 * @property {import('mongoose').Types.ObjectId} _id
 * @property {string} guildId
 * @property {string} channelId - One sticky per channel
 * @property {string} content
 * @property {string | null} [lastMessageId] - The copy currently at the bottom
 */

const StickyMessageSchema = new Schema({
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    lastMessageId: { type: String, default: null },
});

export const StickyMessage = model('Guild-Sticky-Message', StickyMessageSchema);
