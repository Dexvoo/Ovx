const { Events, EmbedBuilder, Colors } = require('discord.js');
require('dotenv').config();

const { DevGuildID, JoinGuildLogCID } = process.env;



module.exports = {
    name: Events.GuildCreate,
    once: false,
    nickname: 'Guild Join Logs',

    /**
     * @param {import('../../types').GuildUtils} guild - Discord Guild
     */
    async execute(guild) {
        const { client, name, id, ownerId } = guild;

        try {
            if (!name) return;

            const Embed = new EmbedBuilder()
                .setTitle('Guild Joined')
                .setColor(Colors.Green)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: 'Guild', value: `${name} (\`${id}\`)`, inline: false },
                    { name: 'Owner', value: `<@${ownerId}>`, inline: true },
                    { name: 'Members', value: guild.memberCount.toLocaleString() || 'Unknown', inline: true }
                )
                .setTimestamp();

            await client.utils.EmbedDev('joinGuild', client, Embed);

        } catch (error) {
            client.utils.LogData('Guild Join Logs', `Failed to process event: ${error.message}`, 'error');
        }
    }
};