import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * General per-server settings for the bot itself (set on the dashboard's Bot Settings page).
 *
 * @typedef {Object} GuildSettingsType
 * @property {string} guildId
 * @property {string | null} embedColour - '#rrggbb' for the bot's general embeds, or null for the default purple
 * @property {string | null} bio - The bot's About Me in this server. Stored because Discord doesn't return it.
 * @property {Date | null} premiumUntil - Server premium (granted with /premium); null when the server doesn't have it
 */

const GuildSettingsSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    embedColour: { type: String, default: null },
    bio: { type: String, default: null },
    premiumUntil: { type: Date, default: null },
});

export const GuildSettings = model('Guild-Settings', GuildSettingsSchema);
