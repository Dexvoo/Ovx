import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const GIVEAWAY_STATUSES = Object.freeze(['scheduled', 'running', 'ending', 'ended', 'cancelled']);

/**
 * One giveaway. Started with /giveaway start or on the dashboard (which can also schedule it for later).
 *
 * @typedef {Object} GiveawayType
 * @property {import('mongoose').Types.ObjectId} _id
 * @property {string} guildId
 * @property {string} channelId
 * @property {string | null} [messageId] - null until it's posted (scheduled giveaways)
 * @property {string} prize
 * @property {string | null} [description]
 * @property {number} winnerCount
 * @property {string} hostId - Shown as the host
 * @property {string} createdBy - Who started or scheduled it
 * @property {Date} startsAt
 * @property {Date} endsAt
 * @property {string} status - One of GIVEAWAY_STATUSES; 'ending' while winners are drawn
 * @property {{ roleIds: string[], minLevel: number }} [requirements] - Members need any one of the roles
 * @property {number} voteBonus - Extra entries for members who voted for Ovx on Top.gg in the last 12 hours
 * @property {string[]} winners - Everyone who has won, including rerolls
 * @property {number} entrantCount
 * @property {Date | null} [endedAt]
 * @property {Date} createdAt
 */

const GiveawaySchema = new Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    prize: { type: String, required: true },
    description: { type: String, default: null },
    winnerCount: { type: Number, required: true, min: 1 },
    hostId: { type: String, required: true },
    createdBy: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: GIVEAWAY_STATUSES, default: 'running' },
    requirements: {
        roleIds: { type: [String], default: [] },
        minLevel: { type: Number, default: 0 },
    },
    voteBonus: { type: Number, default: 0 },
    winners: { type: [String], default: [] },
    entrantCount: { type: Number, default: 0 },
    endedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
});

GiveawaySchema.index({ guildId: 1, status: 1 });
GiveawaySchema.index({ status: 1, endsAt: 1 });
GiveawaySchema.index({ status: 1, startsAt: 1 });

export const Giveaway = model('Guild-Giveaway', GiveawaySchema);

/**
 * Someone's entry in a giveaway. Kept in its own collection so big giveaways don't make one huge document,
 * and so entering twice is stopped by the unique index rather than a race-prone check.
 *
 * @typedef {Object} GiveawayEntryType
 * @property {import('mongoose').Types.ObjectId} giveawayId
 * @property {string} guildId
 * @property {string} userId
 * @property {number} entries - 1, plus the vote bonus if they had voted
 * @property {Date} enteredAt
 */

const GiveawayEntrySchema = new Schema({
    giveawayId: { type: Schema.Types.ObjectId, required: true },
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    entries: { type: Number, default: 1, min: 1 },
    enteredAt: { type: Date, default: Date.now },
});

GiveawayEntrySchema.index({ giveawayId: 1, userId: 1 }, { unique: true });
GiveawayEntrySchema.index({ guildId: 1 });

export const GiveawayEntry = model('Guild-Giveaway-Entry', GiveawayEntrySchema);

/**
 * Per-server giveaway settings (the dashboard's Giveaways page).
 *
 * @typedef {Object} GiveawayConfigType
 * @property {string} guildId
 * @property {string[]} managerRoleIds - Can run giveaways without Manage Server
 */

const GiveawayConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    managerRoleIds: { type: [String], default: [] },
});

export const GiveawayConfig = model('Guild-Giveaway-Config', GiveawayConfigSchema);
