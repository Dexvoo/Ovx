import { Events, AuditLogEvent } from 'discord.js';
import { getLogChannel, findAuditLogExecutor } from '../../utils/logChannel.js';

export const name = Events.ChannelCreate;
export const once = false;
export const description = 'Guild Channel Create Logs';

/**
 * @param {import('discord.js').GuildChannel} channel
 */

export async function execute(channel) {
    const { guild, client } = channel;

    if (!guild) return;

    const logChannel = await getLogChannel(guild, 'channel');
    if (!logChannel) return;

    const executor = await findAuditLogExecutor(
        guild,
        AuditLogEvent.ChannelCreate,
        (entry) => entry.targetId === channel.id
    );
    const username = executor?.username ?? 'Unknown';

    const title = client.utils.Translate('logs.channel.create', guild.preferredLocale, { username });
    const footerText = `CID: ${channel.id} | ${executor ? `UID: ${executor.id}` : ''}`;

    await client.utils.Embed(logChannel, 'Green', title, `${channel} | ${executor ?? 'Unknown Tag'}`, {
        timestamp: true,
        footer: { text: footerText },
    });
}
