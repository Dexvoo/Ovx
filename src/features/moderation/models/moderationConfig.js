import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * What happens automatically when a member reaches a number of warnings.
 * @typedef {Object} WarnActionType
 * @property {number} warnings - Runs when a warning brings them to exactly this many
 * @property {'mute' | 'kick' | 'ban'} action
 * @property {number | null} durationMs - How long a mute lasts (null for kick and ban)
 */

/**
 * @typedef {Object} ModerationConfigType
 * @property {string} guildId
 * @property {WarnActionType[]} warnActions - Sorted by warnings, each count used once
 */

const WarnActionSchema = new Schema(
    {
        warnings: { type: Number, required: true },
        action: { type: String, enum: ['mute', 'kick', 'ban'], required: true },
        durationMs: { type: Number, default: null },
    },
    { _id: false }
);

const ModerationConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    warnActions: { type: [WarnActionSchema], default: [] },
});

export const ModerationConfig = model('Guild-Moderation-Config', ModerationConfigSchema);
