import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const PANEL_MODES = Object.freeze(['normal', 'unique', 'verify']);
export const BUTTON_STYLES = Object.freeze(['primary', 'secondary', 'success', 'danger']);

/**
 * A message with a button per role, made on the dashboard's Reaction Roles page.
 *
 * @typedef {Object} RoleButton
 * @property {string} roleId
 * @property {string | null} [label] - Falls back to the role's name
 * @property {string | null} [emoji] - A Unicode emoji or <:name:id>
 * @property {string} style - One of BUTTON_STYLES
 *
 * @typedef {Object} ReactionRolePanelType
 * @property {import('mongoose').Types.ObjectId} _id
 * @property {string} guildId
 * @property {string} channelId
 * @property {string | null} [messageId] - null until it's posted
 * @property {string} title
 * @property {string | null} [description] - When empty, the message lists the roles
 * @property {string | null} [colour] - '#rrggbb', or null for the server's embed colour
 * @property {string} mode - 'normal': take or remove any; 'unique': only one at a time; 'verify': can't be removed here
 * @property {string | null} [requiredRoleId] - Only members with this role can use the panel
 * @property {number} maxRoles - In normal mode, how many of the panel's roles someone can have (0 for no limit)
 * @property {RoleButton[]} buttons
 * @property {Date} createdAt
 */

const RoleButtonSchema = new Schema(
    {
        roleId: { type: String, required: true },
        label: { type: String, default: null },
        emoji: { type: String, default: null },
        style: { type: String, enum: BUTTON_STYLES, default: 'secondary' },
    },
    { _id: false }
);

const ReactionRolePanelSchema = new Schema({
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    title: { type: String, required: true },
    description: { type: String, default: null },
    colour: { type: String, default: null },
    mode: { type: String, enum: PANEL_MODES, default: 'normal' },
    requiredRoleId: { type: String, default: null },
    maxRoles: { type: Number, default: 0 },
    buttons: { type: [RoleButtonSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
});

export const ReactionRolePanel = model('Guild-Reaction-Role-Panel', ReactionRolePanelSchema);

/**
 * Dropdown panels made with the old Ovx bot's /reactionroles. Still answered (see utils/legacy.js) so
 * panels already in servers keep working, but new panels use buttons.
 */
const LegacyReactionRolesSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        messageId: { type: String, required: true, unique: true },
        channelId: { type: String, required: true },
        title: { type: String, default: 'Default Reaction Roles' },
        enabled: { type: Boolean, default: false },
        roles: { type: [{ roleId: String, roleEmoji: String }], default: [] },
    },
    { timestamps: true }
);

export const LegacyReactionRoles = model('Guild-Reaction-Roles', LegacyReactionRolesSchema);
