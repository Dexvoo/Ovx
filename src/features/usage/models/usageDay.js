import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * One day of Ovx's usage, for the developer page: how often each command was used, which servers used any,
 * and how many servers added or removed Ovx. No user IDs are kept.
 *
 * @typedef {Object} UsageDayType
 * @property {string} day - "2026-10-13" (UTC)
 * @property {Record<string, number>} commands - "moderation ban" → uses
 * @property {string[]} guilds - Servers that used a command that day
 * @property {number} joins
 * @property {number} leaves
 */

const UsageDaySchema = new Schema(
    {
        day: { type: String, required: true, unique: true },
        commands: { type: Schema.Types.Mixed, default: {} },
        guilds: { type: [String], default: [] },
        joins: { type: Number, default: 0 },
        leaves: { type: Number, default: 0 },
    },
    { minimize: false }
);

export const UsageDay = model('Bot-Usage-Day', UsageDaySchema);
