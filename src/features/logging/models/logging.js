import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * @typedef {Object} LogsType
 * @property {Boolean} enabled
 * @property {String} channelId
 */

const LogChannelSchema = new Schema(
    {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
    },
    { _id: false }
);

/** Every log category a guild can configure. */
export const LOG_TYPES = /** @type {const} */ ([
    'message',
    'channel',
    'join',
    'leave',
    'voice',
    'role',
    'server',
    'member',
    'punishment',
]);

/**
 * @typedef {typeof LOG_TYPES[number]} LogType
 */

/**
 * Categories are optional: they only exist once set up.
 * @typedef {{ guildId: string, ignoredChannels?: string[] } & Partial<Record<LogType, LogsType>>} LogsConfigType
 */

/**
 * Join and leave logs used to be posted with member logs. Until a server sets them up on their own,
 * they keep following the member log settings so existing setups don't lose them.
 * @type {Partial<Record<LogType, LogType>>}
 */
const FALLBACK_TYPES = { join: 'member', leave: 'member' };

/**
 * The settings a log type actually uses, including the join/leave fallback.
 * @param {LogsConfigType} config
 * @param {LogType} type
 * @returns {LogsType | undefined} undefined if it isn't set up
 */
export function logSettings(config, type) {
    return config[type] ?? (FALLBACK_TYPES[type] ? config[FALLBACK_TYPES[type]] : undefined);
}
const LogsConfigSchema = new Schema(
    {
        guildId: { type: String, required: true, unique: true, index: true },
        message: LogChannelSchema,
        channel: LogChannelSchema,
        join: LogChannelSchema,
        leave: LogChannelSchema,
        voice: LogChannelSchema,
        role: LogChannelSchema,
        server: LogChannelSchema,
        member: LogChannelSchema,
        punishment: LogChannelSchema,

        ignoredChannels: { type: [String], default: [] }, // Add this line
    },
    { timestamps: true }
);

export const LogsConfig = model('Guild-Logs-Config', LogsConfigSchema);
