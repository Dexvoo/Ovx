import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * @typedef {Object} LevelReward
 * @property {number} level - The level at which the reward is granted.
 * @property {string} roleId - The ID of the role to grant.
 */

/**
 * @typedef {Object} RoleMultiplier
 * @property {string} roleId - The ID of the role that provides a bonus XP multiplier.
 * @property {number} multiplier - The multiplier applied to XP gained when the user has this role.
 */

/**
 * @typedef {Object} GuildLevelsType
 * @property {string} guildId - The ID of the guild this configuration applies to.
 * @property {boolean} enabled - Whether the leveling system is enabled.
 * @property {string} channelId - The ID of the channel where level-up messages are sent.
 * @property {{ roleIds: string[], channelIds: string[] }} blacklisted - IDs of roles and channels that should not gain XP.
 * @property {LevelReward[]} rewards - Array of level reward configurations.
 * @property {boolean} removePastRewards - If true, removes previously granted level reward roles when a new one is given.
 * @property {number} xpMultiplier - Multiplier applied to all XP earned in the guild.
 * @property {number} messageCooldown - Cooldown in seconds between XP gains per user.
 * @property {number} maxLevel - The maximum level a user can reach.
 * @property {string} levelUpMessage - Template message sent when a user levels up. Use placeholders like {user} and {level}.
 * @property {RoleMultiplier[]} roleMultipliers - Roles that apply bonus XP multipliers when held.
 * @property {boolean} publicLeaderboard - Whether anyone can view the leaderboard on the dashboard without logging in.
 */

const LevelConfigSchema = new Schema({
    guildId: { type: String, required: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    blacklisted: {
        roleIds: { type: [String], default: [] },
        channelIds: { type: [String], default: [] },
    },
    rewards: { type: Array, default: [] },
    removePastRewards: { type: Boolean, default: false },
    xpMultiplier: { type: Number, default: 1 },
    messageCooldown: { type: Number, default: 60 },
    maxLevel: { type: Number, default: 100 },
    levelUpMessage: {
        type: String,
        default: '{user}, you just gained a level! Current Level: **{level}**!',
    },
    roleMultipliers: [{ roleId: String, multiplier: Number }],
    // Opt-in: a public leaderboard shows member names and levels to anyone with the link
    publicLeaderboard: { type: Boolean, default: false },
});

LevelConfigSchema.index({ guildId: 1 }, { unique: true });

export const LevelConfig = model('Guild-Level-Config', LevelConfigSchema);
