import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * Per-server command settings (the dashboard's Commands page): commands turned off, or limited to some
 * channels or roles. Members with Manage Server are never limited.
 *
 * @typedef {Object} CommandRule
 * @property {string[]} channelIds - Only usable here (empty: anywhere)
 * @property {string[]} roleIds - Only usable by members with one of these (empty: anyone)
 *
 * @typedef {Object} CommandSettingsType
 * @property {string} guildId
 * @property {string[]} disabled - Command names turned off
 * @property {Record<string, CommandRule>} rules - Command name → its limits
 */

const CommandSettingsSchema = new Schema(
    {
        guildId: { type: String, required: true, unique: true },
        disabled: { type: [String], default: [] },
        rules: { type: Schema.Types.Mixed, default: {} },
    },
    { minimize: false }
);

export const CommandSettings = model('Guild-Command-Settings', CommandSettingsSchema);

/** @param {string} guildId @returns {CommandSettingsType} */
export const commandSettingsDefaults = (guildId) => ({ guildId, disabled: [], rules: {} });
