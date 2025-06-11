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


module.exports = {
    TicketInstance: model('Guild-Tickets', TicketInstanceSchema),
    TicketConfig: model('Guild-Tickets-Config', TicketConfigSchema),
    TicketConfigType: TicketConfigSchema,
    LogsConfig: model('Guild-Logs-Config', LogsConfigSchema),
    LogsConfigType: LogsConfigSchema,
};

