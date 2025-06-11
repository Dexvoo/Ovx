const { Colors, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { SendEmbed, ShortTimestamp } = require('../../utils/LoggingData');
const { permissionCheck } = require('../../utils/Permissions');
require('dotenv').config()

const { DeveloperIDs } = process.env;

/**
 * @param {ChatInputCommandInteraction} interaction
 */
module.exports = async function LogsView(interaction) {
    const { options, guildId } = interaction;
    
    const type = options.getString('log-type');

    const Cache_Logs = require('../../cache/Logs');
    const currentConfig = await Cache_Logs.get(guildId);

    if(!currentConfig) {
        return SendEmbed(interaction, Colors.Red, 'Logs Setup', `No configuration found for \`${type}\` logs`);
    }

    if(type === 'all') {
        const embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle('Current Logs Configuration')
            .setDescription(`Here are the current log settings for this server:`)
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        for(const [logType, config] of Object.entries(currentConfig)) {
            if(config.enabled === undefined) continue;
            embed.addFields({
                name: logType.charAt(0).toUpperCase() + logType.slice(1),
                value: `${config.enabled ? '<a:OVX_Yes:1115593935746781185>' : '<a:OVX_No:1115593604073791488>'}\n${config.channelId ? `<#${config.channelId}>` : ''}`,
                inline: true
            });
        }

        return interaction.reply({ embeds: [embed] });
    }

    const config = currentConfig[type];
    if(!config) {
        return SendEmbed(interaction, Colors.Red, 'Logs Setup', `No configuration found for \`${type}\` logs`);
    }

    const embed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle(`Current Configuration for ${type.charAt(0).toUpperCase() + type.slice(1)} Logs`)
        .setDescription(`Here are the current settings for \`${type}\` logs:`)
        .addFields(
            { name: 'Enabled', value: config.enabled ? '<a:OVX_Yes:1115593935746781185>' : '<a:OVX_No:1115593604073791488>', inline: true },
            { name: 'Channel', value: config.channelId ? `<#${config.channelId}>` : 'Not set', inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

    return interaction.reply({ embeds: [embed] });
};