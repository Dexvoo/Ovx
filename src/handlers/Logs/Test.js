const { Colors, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function LogsTest(interaction) {
    const { options, guildId, client } = interaction;
    
    const type = options.getString('log-type');

    const Cache_Logs = require('../../cache/Logs');
    const currentConfig = await Cache_Logs.get(guildId);

    if(!currentConfig) return client.utils.Embed(interaction, Colors.Red, 'Logs Setup', `No configuration found for \`${type}\` logs`);

    if(type === 'all') {
        const successfulLogs = [];
        const failedLogs = [];

        client.utils.Embed(interaction, Colors.Blurple, 'Logs Testing In Progress', `User: ${interaction.member}`);
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
            const [hasMessagePermissions, missingMessagePermissions] = client.utils.PermCheck(channel, botPermissionsInMessage, interaction.client);
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
                return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', `Failed to send a test log in ${channel}`);
            }

            successfulLogs.push(logType);
        }

        client.utils.Embed(interaction, Colors.Blurple, 'Logs Test Complete', `User: ${interaction.member}\nSuccessful: \`${successfulLogs.length > 0 ? successfulLogs.join(', ') : 'None'}\`\nFailed: \`${failedLogs.length > 0 ? failedLogs.join(', ') : 'None'}\``, false);

        return
    }

    const config = currentConfig[type];
    if(!config) {
        return client.utils.Embed(interaction, Colors.Red, 'Logs Setup', `No configuration found for \`${type}\` logs`);
    }

    const channel = interaction.guild.channels.cache.get(config.channelId) || await interaction.guild.channels.fetch(config.channelId).catch(() => null);
    if(!channel) {
        await Cache_Logs.deleteType(guildId, type);
        return client.utils.Embed(interaction, Colors.Red, 'Logs Setup', `Log channel for \`${type}\` not found. Please check the configuration.`);
    }

    const botPermissionsInMessage = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
    const [hasMessagePermissions, missingMessagePermissions] = client.utils.PermCheck(channel, botPermissionsInMessage, interaction.client);
    if(!hasMessagePermissions) {
        await Cache_Logs.deleteType(guildId, type);
        return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', `Bot Missing Permissions | \`${missingMessagePermissions.join(', ')}\` in ${channel}`);
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
        return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', `Failed to send a test log in ${channel}`);
    }

    return client.utils.Embed(interaction, Colors.Blurple, 'Logs Test', `Successfully sent a test log for \`${type}\` logs in ${channel}`);
};