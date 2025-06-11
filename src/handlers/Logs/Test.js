const { Colors, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { SendEmbed, ShortTimestamp } = require('../../utils/LoggingData');
const { permissionCheck } = require('../../utils/Permissions');
require('dotenv').config()

const { DeveloperIDs } = process.env;

/**
 * @param {ChatInputCommandInteraction} interaction
 */
module.exports = async function LogsTest(interaction) {
    const { options, guildId } = interaction;
    
    const type = options.getString('log-type');

    const Cache_Logs = require('../../cache/Logs');
    const currentConfig = await Cache_Logs.get(guildId);

    if(!currentConfig) {
        return SendEmbed(interaction, Colors.Red, 'Logs Setup', `No configuration found for \`${type}\` logs`);
    }

    if(type === 'all') {
        const successfulLogs = [];
        const failedLogs = [];
        for(const [logType, config] of Object.entries(currentConfig)) {
            if(!config.enabled) continue;

            const channel = interaction.guild.channels.cache.get(config.channelId) || await interaction.guild.channels.fetch(config.channelId).catch(() => null);

            if(!channel) {
                await Cache_Logs.deleteType(guildId, logType);
                console.warn(`Log channel for ${logType} not found in guild ${guildId}. Removing from cache and database.`);
                failedLogs.push(logType);
                continue;
            }

            const botPermissionsInMessage = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
            const [hasMessagePermissions, missingMessagePermissions] = permissionCheck(channel, botPermissionsInMessage, interaction.client);
            if(!hasMessagePermissions) {
                await Cache_Logs.deleteType(guildId, logType);
                failedLogs.push(logType);
            }

            const testEmbed = new EmbedBuilder() 
                .setColor(Colors.Blurple)
                .setTitle(`Test Log for ${logType.charAt(0).toUpperCase() + logType.slice(1)}`)
                .setDescription(`This is a test log for \`${logType}\` logs`)
                .setFooter({ text: `Tested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            const sentMessage = await channel.send({ embeds: [testEmbed] });
            if(!sentMessage) {
                await Cache_Logs.deleteType(guildId, logType);
                failedLogs.push(logType);
                return SendEmbed(interaction, Colors.Red, 'Failed Setup', `Failed to send a test log in ${channel}`, []);
            }

            successfulLogs.push(logType);
        }

        return SendEmbed(interaction, Colors.Blurple, 'Logs Test', `Successfully sent test logs for all configured log types.`, [
            { name: 'Successful Logs', value: successfulLogs.length > 0 ? successfulLogs.join(', ') : 'None', inline: true },
            { name: 'Failed Logs', value: failedLogs.length > 0 ? failedLogs.join(', ') : 'None', inline: true }
        ], false);
    }

    const config = currentConfig[type];
    if(!config) {
        return SendEmbed(interaction, Colors.Red, 'Logs Setup', `No configuration found for \`${type}\` logs`);
    }

    const channel = interaction.guild.channels.cache.get(config.channelId) || await interaction.guild.channels.fetch(config.channelId).catch(() => null);
    if(!channel) {
        await Cache_Logs.deleteType(guildId, type);
        return SendEmbed(interaction, Colors.Red, 'Logs Setup', `Log channel for \`${type}\` not found. Please check the configuration.`);
    }

    const botPermissionsInMessage = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
    const [hasMessagePermissions, missingMessagePermissions] = permissionCheck(channel, botPermissionsInMessage, interaction.client);
    if(!hasMessagePermissions) {
        await Cache_Logs.deleteType(guildId, type);
        return SendEmbed(interaction, Colors.Red, 'Failed Setup', `Bot Missing Permissions | \`${missingMessagePermissions.join(', ')}\` in ${channel}`, []);
    }

    const testEmbed = new EmbedBuilder() 
        .setColor(Colors.Blurple)
        .setTitle(`Test Log for ${type.charAt(0).toUpperCase() + type.slice(1)}`)
        .setDescription(`This is a test log for \`${type}\` logs`)
        .setFooter({ text: `Tested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

    const sentMessage = await channel.send({ embeds: [testEmbed] });
    if(!sentMessage) {
        await Cache_Logs.deleteType(guildId, type);
        return SendEmbed(interaction, Colors.Red, 'Failed Setup', `Failed to send a test log in ${channel}`, []);
    }

    return SendEmbed(interaction, Colors.Blurple, 'Logs Test', `Successfully sent a test log for \`${type}\` logs in ${channel}`);
};