import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * Starboard settings (the dashboard's Starboard page).
 *
 * @typedef {Object} StarboardConfigType
 * @property {string} guildId
 * @property {boolean} enabled
 * @property {string | null} channelId - Where starred messages are posted
 * @property {string} emoji - A Unicode emoji or <:name:id>
 * @property {number} threshold - Stars needed to be posted
 * @property {boolean} selfStar - The author's own star counts
 * @property {boolean} allowBots - Bots' messages can be starred
 * @property {boolean} removeBelow - Take the post down if its stars drop below the threshold again
 * @property {string[]} ignoredChannelIds
 */

const StarboardConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    emoji: { type: String, default: '⭐' },
    threshold: { type: Number, default: 3 },
    selfStar: { type: Boolean, default: false },
    allowBots: { type: Boolean, default: false },
    removeBelow: { type: Boolean, default: true },
    ignoredChannelIds: { type: [String], default: [] },
});

export const StarboardConfig = model('Guild-Starboard-Config', StarboardConfigSchema);

/**
 * A message that reached the starboard. Only IDs and the count are stored, never the message's text.
 *
 * @typedef {Object} StarboardPostType
 * @property {string} guildId
 * @property {string} channelId - Where the starred message is
 * @property {string} messageId - The starred message
 * @property {string} authorId
 * @property {string | null} starboardChannelId
 * @property {string | null} starboardMessageId - null after it was taken down
 * @property {number} stars
 * @property {boolean} removed - A moderator deleted the starboard post, so it isn't posted again
 */

const StarboardPostSchema = new Schema(
    {
        guildId: { type: String, required: true },
        channelId: { type: String, required: true },
        messageId: { type: String, required: true, unique: true },
        authorId: { type: String, required: true },
        starboardChannelId: { type: String, default: null },
        starboardMessageId: { type: String, default: null },
        stars: { type: Number, default: 0 },
        removed: { type: Boolean, default: false },
    },
    { timestamps: true }
);

StarboardPostSchema.index({ guildId: 1, stars: -1 });
StarboardPostSchema.index({ starboardMessageId: 1 });

export const StarboardPost = model('Guild-Starboard-Post', StarboardPostSchema);
