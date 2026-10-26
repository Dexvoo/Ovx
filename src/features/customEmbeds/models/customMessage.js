import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * A message built on the dashboard's Custom Embeds page: text, an embed and link buttons.
 * Kept after posting so it can be edited (the message in Discord is updated in place).
 *
 * @typedef {Object} CustomEmbedType
 * @property {string | null} [title]
 * @property {string | null} [url] - Makes the title a link
 * @property {string | null} [description]
 * @property {string | null} [colour] - '#rrggbb', or null for the server's embed colour
 * @property {{ name: string | null, iconUrl: string | null, url: string | null }} [author]
 * @property {{ name: string, value: string, inline: boolean }[]} [fields]
 * @property {string | null} [thumbnailUrl]
 * @property {string | null} [imageUrl]
 * @property {{ text: string | null, iconUrl: string | null }} [footer]
 * @property {boolean} [timestamp] - Shows when the message was posted
 *
 * @typedef {Object} CustomMessageType
 * @property {import('mongoose').Types.ObjectId} _id
 * @property {string} guildId
 * @property {string} name - Only shown on the dashboard
 * @property {string} channelId
 * @property {string | null} [messageId] - null until it's posted
 * @property {string | null} [content] - Text above the embed
 * @property {CustomEmbedType} [embed]
 * @property {{ label: string, url: string, emoji: string | null }[]} [buttons]
 * @property {boolean} [allowPings] - Let mentions in it ping (off: they're shown but don't notify)
 * @property {Date} createdAt
 */

const CustomMessageSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        channelId: { type: String, required: true },
        messageId: { type: String, default: null },
        content: { type: String, default: null },
        embed: {
            title: { type: String, default: null },
            url: { type: String, default: null },
            description: { type: String, default: null },
            colour: { type: String, default: null },
            author: {
                name: { type: String, default: null },
                iconUrl: { type: String, default: null },
                url: { type: String, default: null },
            },
            fields: { type: [{ name: String, value: String, inline: Boolean, _id: false }], default: [] },
            thumbnailUrl: { type: String, default: null },
            imageUrl: { type: String, default: null },
            footer: {
                text: { type: String, default: null },
                iconUrl: { type: String, default: null },
            },
            timestamp: { type: Boolean, default: false },
        },
        buttons: { type: [{ label: String, url: String, emoji: String, _id: false }], default: [] },
        allowPings: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const CustomMessage = model('Guild-Custom-Message', CustomMessageSchema);
