import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/** @typedef {'warn' | 'ban' | 'unban' | 'kick' | 'mute' | 'unmute' | 'note'} CaseAction */
/** A note is private to moderators: the member isn't told, and it doesn't count as a warning */
export const CASE_ACTIONS = Object.freeze(['warn', 'ban', 'unban', 'kick', 'mute', 'unmute', 'note']);

/**
 * One moderation action against a member: a server's case history.
 * Names are stored as they were at the time, so the history still reads well after people leave or rename.
 * @typedef {Object} ModCaseType
 * @property {string} guildId
 * @property {number} number - Case #1, #2… per server
 * @property {CaseAction} action
 * @property {string} userId - Who it was done to
 * @property {string} username
 * @property {string | null} moderatorId - null when Discord's audit log didn't say who
 * @property {string | null} moderatorName
 * @property {string | null} reason
 * @property {number | null} durationMs - How long a mute or temporary ban was for
 * @property {'command' | 'discord'} source - /moderation, or done in Discord directly (found in the audit log)
 * @property {Date} createdAt
 */

const ModCaseSchema = new Schema({
    guildId: { type: String, required: true },
    number: { type: Number, required: true },
    action: { type: String, enum: CASE_ACTIONS, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    moderatorId: { type: String, default: null },
    moderatorName: { type: String, default: null },
    reason: { type: String, default: null },
    durationMs: { type: Number, default: null },
    source: { type: String, enum: ['command', 'discord'], default: 'command' },
    createdAt: { type: Date, default: Date.now },
});

// Newest-first per server, and one member's history
ModCaseSchema.index({ guildId: 1, number: -1 }, { unique: true });
ModCaseSchema.index({ guildId: 1, userId: 1, number: -1 });

export const ModCase = model('Guild-Mod-Case', ModCaseSchema);

/** The last case number used in each server, so numbers are never reused (even after a case is deleted). */
const ModCaseCounterSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    lastCase: { type: Number, default: 0 },
});

export const ModCaseCounter = model('Guild-Mod-Case-Counter', ModCaseCounterSchema);
