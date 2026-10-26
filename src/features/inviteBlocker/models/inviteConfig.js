import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * Invite blocker settings (the dashboard's Invite Blocker page). Same collection as the old Ovx bot,
 * which only stored `enabled`, so servers that had it on keep it on.
 *
 * @typedef {Object} InviteConfigType
 * @property {string} guildId
 * @property {boolean} enabled
 * @property {boolean} allowOwnInvites - Invites to this server are allowed
 * @property {boolean} notify - A short message in the channel says why it was removed (deleted after a few seconds)
 * @property {boolean} warn - Also gives a warning, which can trigger the server's automatic actions
 * @property {string[]} ignoredChannelIds
 * @property {string[]} ignoredRoleIds - Members with any of these can post invites
 */

const InviteConfigSchema = new Schema({
    guildId: { type: String, required: true, index: true },
    enabled: { type: Boolean, default: false },
    allowOwnInvites: { type: Boolean, default: true },
    notify: { type: Boolean, default: true },
    warn: { type: Boolean, default: false },
    ignoredChannelIds: { type: [String], default: [] },
    ignoredRoleIds: { type: [String], default: [] },
});

export const InviteConfig = model('Guild-InviteDetection-Config', InviteConfigSchema);

/**
 * Fills in settings the old bot's documents don't have.
 * @param {string} guildId
 * @param {Partial<InviteConfigType> | null} [stored]
 * @returns {InviteConfigType}
 */
export function withInviteDefaults(guildId, stored = null) {
    return {
        guildId,
        enabled: stored?.enabled ?? false,
        allowOwnInvites: stored?.allowOwnInvites ?? true,
        notify: stored?.notify ?? true,
        warn: stored?.warn ?? false,
        ignoredChannelIds: stored?.ignoredChannelIds ?? [],
        ignoredRoleIds: stored?.ignoredRoleIds ?? [],
    };
}
