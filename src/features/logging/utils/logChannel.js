import { PermissionFlagsBits } from 'discord.js';
import Logs_Cache from '../cache/logs.cache.js';
import { logSettings } from '../models/logging.js';
import { PermissionCheck } from '../../../shared/utils/permissions.js';
import { LogData } from '../../../shared/utils/logger.js';
import { parseAuditReason } from '../../moderation/utils/checks.js';

/**
 * @typedef {import('../models/logging.js').LogType} LogType
 */

const REQUIRED_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
];

/**
 * Finds the channel a log type should be posted to.
 * If the configured channel is gone or the bot can't post there, the log type is turned off.
 *
 * @param {import('discord.js').Guild} guild
 * @param {LogType} type
 * @param {object} [options]
 * @param {string | null} [options.sourceChannelId] - The channel the event happened in; skipped if it's on the ignore list
 * @returns {Promise<import('discord.js').GuildTextBasedChannel | null>} null if nothing should be logged
 */
export async function getLogChannel(guild, type, { sourceChannelId } = {}) {
    const config = await Logs_Cache.get(guild.id);
    const settings = logSettings(config, type);
    if (!settings?.enabled || !settings.channelId) return null;

    if (sourceChannelId && config.ignoredChannels?.includes(sourceChannelId)) return null;

    const channel = guild.channels.cache.get(settings.channelId);
    if (!channel?.isTextBased()) {
        await disableLogType(guild, type, 'log channel not found');
        return null;
    }

    const [hasPermissions, missingPermissions] = PermissionCheck(channel, REQUIRED_PERMISSIONS, guild.members.me);
    if (!hasPermissions) {
        await disableLogType(
            guild,
            type,
            `missing permissions in log channel: ${missingPermissions.flat().join(', ')}`
        );
        return null;
    }

    return channel;
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {LogType} type
 * @param {string} reason
 */
async function disableLogType(guild, type, reason) {
    await Logs_Cache.setType(guild.id, type, { enabled: false, channelId: null });
    LogData('Logging', `Guild: ${guild.name} | Disabled '${type}' logs: ${reason}`, 'error');
}

/**
 * Finds who performed an action using the audit log, after giving Discord a moment to write the entry.
 *
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').AuditLogEvent} type
 * @param {(entry: import('discord.js').GuildAuditLogsEntry) => boolean} match - Picks the entry for this action
 * @param {object} [options]
 * @param {number} [options.delayMs=1500] - How long to wait for Discord to write the entry
 * @returns {Promise<import('discord.js').User | import('discord.js').PartialUser | null>} null if it can't be determined
 */
export async function findAuditLogExecutor(guild, type, match, { delayMs = 1500 } = {}) {
    return (await findAuditLogEntry(guild, type, match, { delayMs }))?.executor ?? null;
}

/** "guildId:type:targetId" → a lookup still waiting to fetch, which listeners for the same event can join */
const sharedLookups = new Map();

/**
 * Like findAuditLogExecutor, but the whole entry (with its reason).
 *
 * Several listeners often react to the same event (a ban is logged and recorded as a case), so with a
 * `targetId` they share one fetch instead of each asking Discord. They arrive within moments of each other,
 * well inside the wait before fetching. A lookup can only be joined while it's still waiting, so any later
 * event (another member's, or the same member kicked again) gets a fetch made after its own entry was written.
 *
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').AuditLogEvent} type
 * @param {(entry: import('discord.js').GuildAuditLogsEntry) => boolean} match
 * @param {{ delayMs?: number, targetId?: string }} [options]
 * @returns {Promise<import('discord.js').GuildAuditLogsEntry | null>}
 */
export async function findAuditLogEntry(guild, type, match, { delayMs = 1500, targetId } = {}) {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;

    const key = targetId ? `${guild.id}:${type}:${targetId}` : null;
    let lookup = key ? sharedLookups.get(key) : undefined;
    if (!lookup) {
        lookup = fetchAuditLogPage(guild, type, delayMs, key);
        if (key) sharedLookups.set(key, lookup);
    }

    const entries = await lookup;
    return entries?.find(match) ?? null;
}

/**
 * The latest audit log entries of one type, after giving Discord a moment to write the new one.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').AuditLogEvent} type
 * @param {number} delayMs
 * @param {string | null} key - Its entry in sharedLookups, closed to newcomers once the fetch starts
 */
async function fetchAuditLogPage(guild, type, delayMs, key) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (key) sharedLookups.delete(key);
    try {
        return (await guild.fetchAuditLogs({ limit: 5, type })).entries;
    } catch (error) {
        LogData('Logging', `Guild: ${guild.name} | Audit log fetch failed: ${error.message}`, 'warning');
        return null;
    }
}

/**
 * Who really did a moderation action, and why. When it was done with /moderation, Discord records Ovx as
 * the executor and the moderator is in the reason ("By @name: reason"), so they're shown instead.
 * @param {import('discord.js').GuildAuditLogsEntry | null} entry
 * @param {string} botId
 * @param {string | null} [fallbackReason] - e.g. the reason on the ban itself, if there's no entry
 * @returns {{ moderator: string, reason: string | null }}
 */
export function moderationDetails(entry, botId, fallbackReason = null) {
    const executor = entry?.executor ?? null;
    const reason = entry?.reason ?? fallbackReason;
    // Only when the audit log confirms Ovx did it: anyone can type "By @someone:" as a reason in Discord
    const fromCommand = executor?.id === botId ? parseAuditReason(reason) : null;
    if (fromCommand) {
        return { moderator: `@${fromCommand.moderatorName} (via Ovx)`, reason: fromCommand.reason };
    }
    return { moderator: executor ? executor.toString() : 'Unknown', reason };
}
