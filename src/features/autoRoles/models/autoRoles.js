import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * Roles given automatically when someone joins a server.
 *
 * @typedef {Object} AutoRolesType
 * @property {string} guildId
 * @property {boolean} enabled
 * @property {string[]} humanRoleIds - Given to people (after Rules Screening, if the server uses it)
 * @property {string[]} botRoleIds - Given to bots
 */

const AutoRolesSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    humanRoleIds: { type: [String], default: [] },
    botRoleIds: { type: [String], default: [] },
});

export const AutoRoles = model('Guild-Auto-Roles', AutoRolesSchema);
