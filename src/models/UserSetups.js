const mongoose = require('mongoose');
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
 * @property {number} [totalVoice] - Total voice time in seconds (or other unit)
 * @property {number} [totalDrops] - Total drops claimed
 *
 * @property {number} [messageXP] - XP gained specifically from messages
 * @property {number} [voiceXP] - XP gained specifically from voice activity
 * @property {number} [dropsXP] - XP gained specifically from xp drops
 * 
 * @property {Date} [lastMessageAt] - Last message time that awarded XP
 * @property {Date} [lastVoiceAt] - Last voice session that awarded XP
 * @property {Date} [lastLevelUpAt] - Timestamp of last level-up
 * 
 * @property {number} [dailyStreak] - Current daily XP claim or message streak
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

    dailyStreak: { type: Number, default: 0 }
});



/**
 * @typedef {Object} VoteType
 * @property {string} userId - The ID of the user who voted.
 * @property {number} votes - The number of votes the user has cast.
 * @property {Date} createdAt - The timestamp when this document was created.
 * @property {Date} updatedAt - The timestamp when this document was last updated.
 */
// Vote Schema
const VoteSchema = new Schema({
    userId: { type: String, required: true },
    votes: { type: Number, default: 0 },
}, { timestamps: true });


module.exports = {
    UserLevels: model('User-Levels', UserLevelsSchema),
    UserLevelsType: UserLevelsSchema,

    UserVotes: model('User-Votes', VoteSchema),
    VoteType: VoteSchema,
};