import { EmbedBuilder, Events, Colors } from 'discord.js';

export const name = Events.GuildDelete;
export const once = false;
export const description = 'Developer Guild Leave Logs';

/**
 * @typedef {import('../../../core/extendedClient.js').default} Client
 * @param { import('discord.js').Guild & { client: Client }} guild
 */

export async function execute(guild) {
    const { client, name, id, ownerId } = guild;

    try {
        if (!name) return;

        const Embed = new EmbedBuilder()
            .setTitle('Guild Left')
            .setColor(Colors.Red)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: 'Guild', value: `${name} (\`${id}\`)`, inline: false },
                { name: 'Owner', value: `<@${ownerId}>`, inline: true },
                {
                    name: 'Members',
                    value: guild.memberCount.toLocaleString() || 'Unknown',
                    inline: true,
                }
            )
            .setTimestamp();

        await client.utils.DevEmbed('leaveGuild', client, Embed);
    } catch (err) {
        client.utils.LogData('Guild Delete Logs', `Failed to process event: ${err.message}`, 'error');
    }
}
