import { Events } from 'discord.js';
import { getLogChannel } from '../../utils/logChannel.js';

export const name = Events.MessageUpdate;
export const once = false;
export const description = 'Guild Message Update Logs';

/**
 * @typedef {import('../../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').Message & { client: Client }} oldMessage
 * @param {import('discord.js').Message & { client: Client }} newMessage
 */

export async function execute(oldMessage, newMessage) {
    const { client, guild, channel, author } = newMessage;

    if (!author || author.bot || !newMessage.inGuild()) return;
    // An uncached message's "update" is often Discord changing it quietly (a link preview loading, a pin):
    // only a fresh edit is logged, since the old text can't be compared
    if (oldMessage.partial && !(newMessage.editedTimestamp && Date.now() - newMessage.editedTimestamp < 60_000)) return;

    let oldContent = oldMessage.partial ? '*Unavailable (Uncached)*' : oldMessage.content;
    let newContent = newMessage.content;

    if (!oldMessage.partial && oldContent === newContent) return;

    const logChannel = await getLogChannel(guild, 'message', { sourceChannelId: channel.id });
    if (!logChannel) return;

    oldContent = `**Old Content:**\n${oldContent ? oldContent.substring(0, 1900) : client.utils.Translate('logs.message.delete_noContent', guild.preferredLocale)}`;
    newContent = `\n**New Content:**\n${newContent ? newContent.substring(0, 1900) : client.utils.Translate('logs.message.delete_noContent', guild.preferredLocale)}`;

    const title = client.utils.Translate('logs.message.update_title', guild.preferredLocale, {
        channel: newMessage.channel.name,
    });
    const description = oldContent + newContent;
    const footerText = `MID: ${newMessage.id} | UID: ${author.id}`;
    const url = newMessage.url;

    await client.utils.Embed(logChannel, 'Red', title, description, {
        timestamp: true,
        footer: { text: footerText },
        author,
        url,
    });
}
