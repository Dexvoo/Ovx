import { Events, AuditLogEvent } from 'discord.js';
import { getLogChannel, findAuditLogExecutor } from '../../utils/logChannel.js';

export const name = Events.MessageBulkDelete;
export const once = false;
export const description = 'Guild Message Bulk Delete Logs';

/**
 * @typedef {import('../../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').ReadonlyCollection<string, import('discord.js').Message | import('discord.js').PartialMessage>} messages
 * @param {import('discord.js').GuildTextBasedChannel} channel
 */

export async function execute(messages, channel) {
    const { client, guild } = channel;

    if (!guild) return;

    const logChannel = await getLogChannel(guild, 'message', { sourceChannelId: channel.id });
    if (!logChannel) return;

    // Bulk deletes take Discord longer to write to the audit log
    const executor = await findAuditLogExecutor(
        guild,
        AuditLogEvent.MessageBulkDelete,
        (entry) => entry.targetId === channel.id && Date.now() - entry.createdTimestamp < 10_000,
        { delayMs: 5000 }
    );

    const title = client.utils.Translate('logs.message.bulkDelete_title', guild.preferredLocale, {
        channel: channel.name,
    });
    const description = client.utils.Translate('logs.message.bulkDelete_description', guild.preferredLocale, {
        count: messages.size,
        user: executor ? executor : 'Unknown Tag',
    });
    const footerText = `${executor ? `UID: ${executor.id} | ` : ''}CID: ${channel.id}`;

    await client.utils.Embed(logChannel, 'DarkRed', title, description, {
        timestamp: true,
        footer: { text: footerText },
        author: executor,
    });
}
