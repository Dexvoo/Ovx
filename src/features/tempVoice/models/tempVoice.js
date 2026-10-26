import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * Join-to-create voice settings (the dashboard's Temp Voice page).
 *
 * @typedef {Object} VoiceHub
 * @property {string} channelId - The "Join to create" voice channel
 * @property {string | null} categoryId - Where new channels go (null: the hub's own category)
 * @property {string} nameTemplate - e.g. "{user}'s channel"
 * @property {number} userLimit - 0 for no limit
 *
 * @typedef {Object} TempVoiceConfigType
 * @property {string} guildId
 * @property {boolean} enabled
 * @property {VoiceHub[]} hubs
 */

const VoiceHubSchema = new Schema(
    {
        channelId: { type: String, required: true },
        categoryId: { type: String, default: null },
        nameTemplate: { type: String, default: "{user}'s channel" },
        userLimit: { type: Number, default: 0 },
    },
    { _id: false }
);

const TempVoiceConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    hubs: { type: [VoiceHubSchema], default: [] },
});

export const TempVoiceConfig = model('Guild-Temp-Voice-Config', TempVoiceConfigSchema);

/**
 * A voice channel made for someone. Deleted (with this record) when everyone has left.
 *
 * @typedef {Object} TempChannelType
 * @property {string} guildId
 * @property {string} channelId
 * @property {string} ownerId
 * @property {string} hubId
 * @property {string | null} panelMessageId - The control panel in the channel's chat
 * @property {Date[]} renames - Recent renames, for Discord's limit of 2 per 10 minutes
 * @property {Date} createdAt
 */

const TempChannelSchema = new Schema({
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    hubId: { type: String, required: true },
    panelMessageId: { type: String, default: null },
    renames: { type: [Date], default: [] },
    createdAt: { type: Date, default: Date.now },
});

TempChannelSchema.index({ guildId: 1, ownerId: 1 });

export const TempChannel = model('Guild-Temp-Channel', TempChannelSchema);
