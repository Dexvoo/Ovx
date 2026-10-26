import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * A ban that ends by itself (/moderation ban with a duration). Removed when it ends, or when the member is
 * unbanned some other way first.
 *
 * @typedef {Object} TempBanType
 * @property {string} guildId
 * @property {string} userId
 * @property {string} username
 * @property {Date} expiresAt
 * @property {number | null} [caseNumber] - The ban's case
 */

const TempBanSchema = new Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    caseNumber: { type: Number, default: null },
});

TempBanSchema.index({ guildId: 1, userId: 1 }, { unique: true });
TempBanSchema.index({ expiresAt: 1 });

export const TempBan = model('Guild-Temp-Ban', TempBanSchema);

/**
 * A channel locked with /moderation lock. Keeps what @everyone's permissions were before, so unlocking puts
 * them back exactly (a channel that was already read-only stays read-only).
 *
 * @typedef {Object} ChannelLockType
 * @property {string} guildId
 * @property {string} channelId
 * @property {Record<string, 'allow' | 'deny' | null>} previous - Each locked permission, as it was
 * @property {boolean} [hadOverwrite] - Whether @everyone had its own permissions on the channel before
 * @property {Date | null} [until] - Unlocked automatically then (null: until someone unlocks it)
 * @property {string | null} [moderatorName]
 * @property {string | null} [reason]
 */

const ChannelLockSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        channelId: { type: String, required: true, unique: true },
        previous: { type: Schema.Types.Mixed, default: {} },
        hadOverwrite: { type: Boolean, default: false },
        until: { type: Date, default: null },
        moderatorName: { type: String, default: null },
        reason: { type: String, default: null },
    },
    { minimize: false }
);

ChannelLockSchema.index({ until: 1 });

export const ChannelLock = model('Guild-Channel-Lock', ChannelLockSchema);
