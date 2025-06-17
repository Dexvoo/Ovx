const mongoose = require('mongoose');
const { Schema, model } = mongoose;


/**
 * @typedef {Object} TicketConfigType
 * @property {string} guildId
 * @property {boolean} enabled
 * @property {string} setupChannelId
 * @property {string} ticketCategoryId
 * @property {string} archiveChannelId
 * @property {string} supportRoleId
 * @property {string} adminRoleId
 * @property {number} maxTicketsPerUser
 * @property {number} lastTicketId
 */
const TicketConfigSchema = new Schema({
    guildId: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    setupChannelId: { type: String, required: true },
    ticketCategoryId: { type: String, required: true },
    archiveChannelId: { type: String, required: true },
    supportRoleId: { type: String, required: true },
    adminRoleId: { type: String, required: true },
    maxTicketsPerUser: { type: Number, default: 3,}, 
    lastTicketId: { type: Number, default: 0, },
});

const TicketInstanceSchema = new Schema({
    guildId: { type: String, required: true },
    memberId: { type: String, required: true },
    ticketId: { type: String, required: true },
    channelId: { type: String, required: true },
    buttonId: { type: String, required: true },
    open: { type: Boolean, default: true },
    locked: { type: Boolean, default: false },
    transcriptURL: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null }
});



/**
 * @typedef {Object} LogsType
 * @property {Boolean} enabled
 * @property {String} channelId 
 */

const LogChannelSchema = new Schema({
  enabled: { type: Boolean, default: false },
  channelId: { type: String, default: null },
}, { _id: false }); 


/**
 * @typedef {Object} LogsConfigType
 * @property {string} guildId
 * @property {LogsType} message
 * @property {LogsType} channel
 * @property {LogsType} join
 * @property {LogsType} leave
 * @property {LogsType} voice
 * @property {LogsType} role
 * @property {LogsType} server
 * @property {LogsType} member
 * @property {LogsType} punishment
 * 
 */
const LogsConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    message: LogChannelSchema,
    channel: LogChannelSchema,
    join: LogChannelSchema,
    leave: LogChannelSchema,
    voice: LogChannelSchema,
    role: LogChannelSchema,
    server: LogChannelSchema,
    member: LogChannelSchema,
    punishment: LogChannelSchema,
}, { timestamps: true });


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
 * @typedef {Object} LevelConfigType
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
 */

const LevelConfigSchema = new Schema({
    guildId: { type: String, required: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, required: true },
    blacklisted: { roleIds: { type: [String], default: [] }, channelIds: { type: [String], default: [] }},
    rewards: { type: Array, default: [] },
    removePastRewards: { type: Boolean, default: false },
    xpMultiplier: { type: Number, default: 1 }, 
    messageCooldown: { type: Number, default: 60 },
    maxLevel: { type: Number, default: 100 },
    levelUpMessage: { type: String, default: '{user}, you just gained a level! Current Level: **{level}**!' },
    roleMultipliers: [{ roleId: String, multiplier: Number }]
});

module.exports = {
    TicketInstance: model('Guild-Tickets', TicketInstanceSchema),
    TicketConfig: model('Guild-Tickets-Config', TicketConfigSchema),
    TicketConfigType: TicketConfigSchema,

    LogsConfig: model('Guild-Logs-Config', LogsConfigSchema),
    LogsConfigType: LogsConfigSchema,
    
    LevelConfig: model('Guild-Level-Config', LevelConfigSchema),
    LevelConfigType: LevelConfigSchema,
};

