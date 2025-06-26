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
            if(!name) return;

            const memberCount = guild.memberCount.toLocaleString() || 'Unknown';

            const devGuild = client.guilds.cache.get(DevGuildID) || await client.guilds.fetch(DevGuildID);
            if (!devGuild) return client.utils.LogData('Guild Join Logs', 'Guild not found', 'error');

            const devChannel = devGuild.channels.cache.get(JoinGuildLogCID) || await devGuild.channels.fetch(JoinGuildLogCID);
            if (!devChannel) return client.utils.LogData('Guild Join Logs', 'Channel not found', 'error');

            const Embed = new EmbedBuilder()
                .setTitle('Guild Joined')
                .setColor(Colors.Green)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: 'Guild', value: `${name} (${id})`, inline: false },
                    { name: 'Owner', value: `<@${ownerId}>`, inline: true },
                    { name: 'Members', value: guild.memberCount.toLocaleString() || 'Unknown', inline: true }
                );

            await devChannel.send({ content: '<@387341502134878218>', embeds: [Embed] });
        } catch (error) {
            client.utils.LogData('Command Logs', `Failed to send embed: ${error.message}`, 'error');
        }
    }
};