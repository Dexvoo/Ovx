import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * One kind of message (welcome or goodbye).
 * @typedef {Object} WelcomeMessageType
 * @property {boolean} enabled
 * @property {string | null} channelId
 * @property {string | null} message - null uses the default text (see utils/welcomeMessage.js)
 * @property {boolean} embed - Send the message inside an embed
 * @property {string | null} title - Embed title (embeds only)
 */

/**
 * Messages posted when people join or leave a server.
 * @typedef {Object} WelcomeType
 * @property {string} guildId
 * @property {WelcomeMessageType} welcome
 * @property {WelcomeMessageType} goodbye
 */

const MessageSchema = new Schema(
    {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        message: { type: String, default: null },
        embed: { type: Boolean, default: false },
        title: { type: String, default: null },
    },
    { _id: false }
);

const WelcomeSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    welcome: { type: MessageSchema, default: () => ({}) },
    goodbye: { type: MessageSchema, default: () => ({}) },
});

export const Welcome = model('Guild-Welcome', WelcomeSchema);
