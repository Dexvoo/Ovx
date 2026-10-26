import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const VERIFY_METHODS = Object.freeze(['button', 'code']);

/**
 * Member verification (the dashboard's Verification page): new members click Verify on a panel to get a role.
 *
 * @typedef {Object} VerificationConfigType
 * @property {string} guildId
 * @property {boolean} enabled
 * @property {string | null} channelId - Where the panel is posted
 * @property {string | null} messageId - The panel, once posted
 * @property {string | null} roleId - Given when they verify
 * @property {string | null} unverifiedRoleId - Given when they join, taken away when they verify
 * @property {string} method - 'button': one click; 'code': type a short code too
 * @property {number} minAccountDays - Accounts newer than this can't verify yet
 * @property {number} kickAfterHours - Remove members who haven't verified after this long (0: never)
 * @property {string} title
 * @property {string} description
 * @property {string} buttonLabel
 */

const VerificationConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    messageId: { type: String, default: null },
    roleId: { type: String, default: null },
    unverifiedRoleId: { type: String, default: null },
    method: { type: String, enum: VERIFY_METHODS, default: 'button' },
    minAccountDays: { type: Number, default: 0 },
    kickAfterHours: { type: Number, default: 0 },
    title: { type: String, default: 'Verify to get access' },
    description: { type: String, default: 'Click the button below to verify and see the rest of the server.' },
    buttonLabel: { type: String, default: 'Verify' },
});

export const VerificationConfig = model('Guild-Verification-Config', VerificationConfigSchema);

/** @param {string} guildId @returns {VerificationConfigType} */
export const verificationDefaults = (guildId) => ({
    guildId,
    enabled: false,
    channelId: null,
    messageId: null,
    roleId: null,
    unverifiedRoleId: null,
    method: 'button',
    minAccountDays: 0,
    kickAfterHours: 0,
    title: 'Verify to get access',
    description: 'Click the button below to verify and see the rest of the server.',
    buttonLabel: 'Verify',
});
