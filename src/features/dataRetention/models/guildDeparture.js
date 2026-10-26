import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * A server Ovx was removed from. Its data is deleted once it has been gone for DATA_RETENTION_DAYS,
 * and the record is dropped if Ovx is added back before then.
 *
 * @typedef {Object} GuildDepartureType
 * @property {string} guildId
 * @property {Date} leftAt
 */

const GuildDepartureSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    leftAt: { type: Date, required: true },
});

GuildDepartureSchema.index({ leftAt: 1 });

export const GuildDeparture = model('Guild-Departure', GuildDepartureSchema);
