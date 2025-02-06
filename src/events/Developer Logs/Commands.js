const { Events, Client, CommandInteraction, EmbedBuilder, Colors } = require('discord.js');
const { consoleLogData } = require('../../utils/LoggingData.js');
require('dotenv').config();

const { DevGuildID, CommandLogCID } = process.env;



module.exports = {
    name: Events.InteractionCreate,
    once: false,
    nickname: 'Command Logs',

    /**
     * @param {CommandInteraction} interaction - Discord Client
     */
    async execute(interaction) {
        if (!interaction.isCommand()) return;

        const { client, guild, user, channel } = interaction;

        try {
            const devGuild = client.guilds.cache.get(DevGuildID) || await client.guilds.fetch(DevGuildID);
            if (!devGuild) {
                return consoleLogData('Command Logs', 'Guild not found', 'error');
            }

            const devChannel = devGuild.channels.cache.get(CommandLogCID) || await devGuild.channels.fetch(CommandLogCID);
            if (!devChannel) {
                return consoleLogData('Command Logs', 'Channel not found', 'error');
            }

            const Embed = new EmbedBuilder()
                .setTitle(`Command Executed | Shard #${client.shard.ids}`)
                .setColor(Colors.Blurple)
                .addFields({ name: 'User', value: `@${user.username} (${user.id})`, inline: true })
                .setTimestamp();

            if (guild) {
                Embed.addFields(
                    { name: 'Guild', value: `${guild.name} (${guild.id})`, inline: true },
                    { name: 'Channel', value: `#${channel.name} (${channel.id})`, inline: true }
                );
            }

            let commandText = `/${interaction.commandName}`
            for(let i = 0; i < interaction.options.data.length;i++ ) {
                commandText = `${commandText} ${interaction.options.data[i].name}:${interaction.options.data[i].value}`
            } 
            
            Embed.addFields({ name: 'Command', value: `\`${commandText.substring(0, 1020)}\``, inline: false });

            await devChannel.send({ embeds: [Embed] });
        } catch (error) {
            consoleLogData('Command Logs', `Failed to send embed: ${error.message}`, 'error');
        }
    }
};