import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * @typedef {Object} UserLevelsType
 * @property {string} userId - Discord user ID
 * @property {string} guildId - Discord guild ID
 *
 * @property {number} [xp] - Total XP earned
 * @property {number} [level] - Current level
 *
 * @property {number} [totalMessages] - Total messages sent by user
 * @property {number} [totalVoice] - Total voice time in minutes
 * @property {number} [totalDrops] - Total drops claimed
 * @property {number} [totalCommands] - Total commands used
 *
 * @property {number} [messageXP] - XP gained specifically from messages
 * @property {number} [voiceXP] - XP gained specifically from voice activity
 * @property {number} [dropsXP] - XP gained specifically from xp drops
 *
 * @property {Date} [lastMessageAt] - Last message time that awarded XP
 * @property {Date} [lastVoiceAt] - Last voice session that awarded XP
 * @property {Date} [lastLevelUpAt] - Timestamp of last level-up
 */

const UserLevelsSchema = new Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },

    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },

    totalMessages: { type: Number, default: 0 },
    totalVoice: { type: Number, default: 0 },
    totalCommands: { type: Number, default: 0 },

    messageXP: { type: Number, default: 0 },
    voiceXP: { type: Number, default: 0 },
    dropsXP: { type: Number, default: 0 },

    lastMessageAt: { type: Date, default: null },
    lastVoiceAt: { type: Date, default: null },
    lastLevelUpAt: { type: Date, default: null },
});

// Compound index
UserLevelsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

UserLevelsSchema.index({
    guildId: 1,
    level: -1,
    xp: -1,
});

UserLevelsSchema.index({
    guildId: 1,
    totalMessages: -1,
});

UserLevelsSchema.index({
    guildId: 1,
    totalVoice: -1,
});

UserLevelsSchema.index({
    guildId: 1,
    totalCommands: -1,
});

export const UserLevels = model('User-Levels', UserLevelsSchema);
