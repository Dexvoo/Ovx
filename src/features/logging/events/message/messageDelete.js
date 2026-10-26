import { Events, PermissionFlagsBits, AuditLogEvent, AttachmentBuilder } from 'discord.js';
import { getLogChannel } from '../../utils/logChannel.js';

export const name = Events.MessageDelete;
export const once = false;
export const description = 'Guild Message Delete Logs';

// Discord can take a moment to write the audit log entry after the delete event
const AUDIT_LOG_DELAY_MS = 1500;
// How recently a never-seen audit entry must have been created to count as this delete
const NEW_ENTRY_WINDOW_MS = 10_000;
const MAX_TRACKED_ENTRIES = 1000;

const UPLOAD_LIMITS = {
    0: 10_000_000,
    1: 10_000_000,
    2: 50_000_000,
    3: 100_000_000,
};

/**
 * Last seen `count` per audit log entry ID. Discord groups repeated deletes by the same moderator
 * (same author, same channel) into one entry and increments its count, keeping the original
 * timestamp, so a rising count is the only sign that a later delete was done by a moderator.
 * @type {Map<string, number>}
 */
const seenEntryCounts = new Map();

/**
 * @typedef {import('../../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').Message & { client: Client }} message
 */

export async function execute(message) {
    const { client, guild, channel, content, author } = message;

    if (message.partial || !author || author.bot || !message.inGuild()) return;

    const logChannel = await getLogChannel(guild, 'message', { sourceChannelId: channel.id });
    if (!logChannel) return;

    const executor = await findExecutor(message);

    const uploadLimit = UPLOAD_LIMITS[guild.premiumTier] ?? UPLOAD_LIMITS[0];
    const files = message.attachments
        .filter((attachment) => attachment.size < uploadLimit)
        .map((attachment) => new AttachmentBuilder(attachment.url, { name: attachment.name }));
    const filesTooLarge = message.attachments.size - files.length;

    let deletedText = `-# ${content ? client.utils.Truncate(content, 3900) : client.utils.Translate('logs.message.delete_noContent', guild.preferredLocale)}`;
    if (filesTooLarge > 0) deletedText += `\n### Removed Attachments\n${filesTooLarge}`;

    const title = client.utils.Translate('logs.message.delete_title', guild.preferredLocale, {
        channel: message.channel.name,
    });
    const description = `${channel} | ${executor ?? 'Unknown Tag'}\n${deletedText}`;
    const footer = { text: `MID: ${message.id} | UID: ${author.id}` };

    const sent = await client.utils.Embed(logChannel, 'Red', title, description, {
        timestamp: true,
        footer,
        author,
        files,
    });

    // Attachments of deleted messages are often already gone from Discord's CDN, which fails the
    // whole send. Retry without them so the log itself isn't lost.
    if (!sent && files.length > 0) {
        await client.utils.Embed(
            logChannel,
            'Red',
            title,
            `${description}\n### Unrecoverable Attachments\n${files.length}`,
            { timestamp: true, footer, author }
        );
    }
}

/**
 * Works out who deleted the message using the audit log.
 * Discord only logs deletes of someone else's message, so no matching entry means the author
 * deleted it themselves.
 * @param {import('discord.js').Message} message
 * @returns {Promise<import('discord.js').User | null>} null if it can't be determined
 */
async function findExecutor(message) {
    const { client, guild, channel, author } = message;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;

    await new Promise((resolve) => setTimeout(resolve, AUDIT_LOG_DELAY_MS));

    let entries;
    try {
        ({ entries } = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MessageDelete }));
    } catch (error) {
        client.utils.LogData(
            'Message Deleted',
            `Guild: ${guild.name} | Audit log fetch failed: ${error.message}`,
            'warning'
        );
        return null;
    }

    const now = Date.now();
    const match = entries.find((entry) => {
        if (entry.target?.id !== author.id || entry.extra?.channel?.id !== channel.id) return false;

        const previousCount = seenEntryCounts.get(entry.id);
        if (previousCount === undefined) return now - entry.createdTimestamp < NEW_ENTRY_WINDOW_MS;
        return entry.extra.count > previousCount;
    });

    for (const entry of entries.values()) rememberEntry(entry.id, entry.extra?.count ?? 1);

    return match ? match.executor : author;
}

/**
 * @param {string} entryId
 * @param {number} count
 */
function rememberEntry(entryId, count) {
    // Re-insert so the Map's order stays least-recently-seen first, then trim the oldest
    seenEntryCounts.delete(entryId);
    seenEntryCounts.set(entryId, count);

    while (seenEntryCounts.size > MAX_TRACKED_ENTRIES) {
        seenEntryCounts.delete(seenEntryCounts.keys().next().value);
    }
}
