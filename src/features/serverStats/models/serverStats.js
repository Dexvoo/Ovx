import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const COUNTER_TYPES = Object.freeze(['members', 'humans', 'bots', 'boosts', 'channels', 'roles', 'role']);

/** The name each new counter starts with. */
export const DEFAULT_TEMPLATES = Object.freeze({
    members: '👥 Members: {count}',
    humans: '🧑 People: {count}',
    bots: '🤖 Bots: {count}',
    boosts: '🚀 Boosts: {count}',
    channels: '💬 Channels: {count}',
    roles: '🏷️ Roles: {count}',
    role: '⭐ {role}: {count}',
});

/**
 * Stats channels (the dashboard's Server Stats page): voice channels whose names show a number.
 *
 * @typedef {Object} Counter
 * @property {string} type - One of COUNTER_TYPES
 * @property {string | null} [roleId] - For 'role': whose members are counted
 * @property {string} channelId
 * @property {string} template - The channel name, with {count} (and {role})
 *
 * @typedef {Object} ServerStatsType
 * @property {string} guildId
 * @property {string | null} categoryId - Where Ovx makes the channels
 * @property {Counter[]} counters
 */

const CounterSchema = new Schema(
    {
        type: { type: String, enum: COUNTER_TYPES, required: true },
        roleId: { type: String, default: null },
        channelId: { type: String, required: true },
        template: { type: String, required: true },
    },
    { _id: false }
);

const ServerStatsSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    categoryId: { type: String, default: null },
    counters: { type: [CounterSchema], default: [] },
});

export const ServerStats = model('Guild-Server-Stats', ServerStatsSchema);
