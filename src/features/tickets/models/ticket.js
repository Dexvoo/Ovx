import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * - open: in use
 * - closing: a transcript is being made and the channel is about to be deleted
 * - closed: done (the channel is deleted)
 * @typedef {'open' | 'closing' | 'closed'} TicketStatus
 */

/**
 * One ticket.
 * @typedef {Object} TicketType
 * @property {string} guildId
 * @property {number} number - Shown as #0001
 * @property {string} channelId
 * @property {string | null} controlMessageId - The message with the ticket buttons, updated when it's locked or claimed
 * @property {string} ownerId - Who opened it
 * @property {string | null} typeId - Which ticket type it is (null: from before ticket types, or the default)
 * @property {TicketStatus} status
 * @property {boolean} locked - The owner (and added members) can read but not send messages
 * @property {string | null} claimedBy - Staff member handling it
 * @property {string[]} addedUserIds - Members added with /ticket add
 * @property {Date} createdAt
 * @property {Date | null} closedAt
 * @property {string | null} closedBy
 * @property {string | null} closeReason
 * @property {string | null} transcriptUrl - Link to the transcript in the transcript channel
 */

const TicketSchema = new Schema({
    guildId: { type: String, required: true },
    number: { type: Number, required: true },
    channelId: { type: String, required: true, unique: true },
    controlMessageId: { type: String, default: null },
    ownerId: { type: String, required: true },
    typeId: { type: String, default: null },
    status: { type: String, enum: ['open', 'closing', 'closed'], default: 'open' },
    locked: { type: Boolean, default: false },
    claimedBy: { type: String, default: null },
    addedUserIds: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    closedBy: { type: String, default: null },
    closeReason: { type: String, default: null },
    transcriptUrl: { type: String, default: null },
});

// Counting someone's open tickets, and finding unfinished closes after a restart
TicketSchema.index({ guildId: 1, ownerId: 1, status: 1 });
TicketSchema.index({ status: 1 });

export const Ticket = model('Guild-Ticket', TicketSchema);
