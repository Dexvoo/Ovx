import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * Top.gg votes for Ovx, received by the dashboard's Top.gg webhook. Same collection as the old Ovx bot,
 * so vote counts carry over.
 *
 * @typedef {Object} UserVoteType
 * @property {string} userId
 * @property {number} votes - All-time count
 * @property {Date | null} lastVotedAt
 * @property {boolean} remind - DM them when they can vote again (the "Remind me" button on /vote)
 * @property {Date | null} remindedAt - When the last reminder was sent, so each vote gets one
 */

const UserVoteSchema = new Schema(
    {
        userId: { type: String, required: true, unique: true },
        votes: { type: Number, default: 0 },
        lastVotedAt: { type: Date, default: null },
        remind: { type: Boolean, default: false },
        remindedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Finding reminders that are due
UserVoteSchema.index({ remind: 1, lastVotedAt: 1 });

export const UserVote = model('User-Votes', UserVoteSchema);
