const { Events, EmbedBuilder, Colors, ApplicationCommandOptionType, ChatInputCommandInteraction } = require('discord.js');
require('dotenv').config()

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    nickname: 'Command Logs',


    /**
     * 
     * @param {import('../../types').CommandInputUtils} interaction 
     * @returns 
     */

    async execute(interaction) {
        if (!interaction.isCommand()) return;
        const { client, guild, user, channel } = interaction;

        try {
            const commandText = buildCommandText(interaction);

            const LogEmbed = new EmbedBuilder()
                .setTitle(`Command Executed | Shard #${client.shard?.ids[0] ?? 0}`)
                .setColor(Colors.Blurple)
                .addFields(
                    { name: 'User', value: `@${user.username} (${user})`, inline: true },
                    ...(guild ? [
                        { name: 'Guild', value: `${guild.name} (${guild.id})`, inline: true },
                        { name: 'Channel', value: `${channel}`, inline: true }
                    ] : []),
                    { name: 'Command', value: `\`${commandText.substring(0, 1020)}\``, inline: false }
                )
                .setTimestamp();

            await client.utils.EmbedDev('command', client, LogEmbed);
                

        } catch (error) {
            console.error(error);
            client.utils.LogData('Command Logs', 'Failed to send command log', 'error');
        }
    }
};

function buildCommandText(interaction) {
    let commandText = `/${interaction.commandName}`;
    const options = interaction.options.data;

    for (const opt of options) {
        commandText += ` ${opt.name}`;
        if (opt.type === ApplicationCommandOptionType.SubcommandGroup) {
            for (const sub of opt.options ?? []) {
                commandText += ` ${sub.name}`;
                for (const subOpt of sub.options ?? []) {
                    commandText += ` ${subOpt.name}:${subOpt.value}`;
                }
            }
        } else if (opt.type === ApplicationCommandOptionType.Subcommand) {
            for (const subOpt of opt.options ?? []) {
                commandText += ` ${subOpt.name}:${subOpt.value}`;
            }
        } else {
            commandText += `:${opt.value}`;
        }
    }

    return commandText;
}