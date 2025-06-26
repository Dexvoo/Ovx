const { Colors, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
require('dotenv').config()

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function LogsSetup(interaction) {
    const { client, options, guildId } = interaction;
    
    const type = options.getString('log-type');
    const enabled = options.getBoolean('enabled');
    const channel = options.getChannel('channel') || null;
    
    if(type === 'server') return client.utils.Embed(interaction, Colors.Blurple, `Failed Setup | Unavailable`, `Server logs will be coming soon!`);
    if(!channel && enabled) return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', 'Please provide a channel to send the logs to');

    if(enabled) {
        const botPermissionsInMessage = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasMessagePermissions, missingMessagePermissions] = client.utils.PermCheck(channel, botPermissionsInMessage, client);
        if(!hasMessagePermissions) return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', `Bot Missing Permissions | \`${missingMessagePermissions.join(', ')}\` in ${channel}`);


        const testEmbed = new EmbedBuilder() 
            .setColor(Colors.Blurple)
            .setTitle('Test Log')
            .setDescription(`This is a test log for \`${type}\` logs`)
            .setFooter({ text: `Tested by @${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        const sentMessage = await channel.send({ embeds: [testEmbed] });
        if(!sentMessage) return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', `Failed to send a test log in ${channel}`);
    };

    const Cache_Logs = require('../../cache/Logs');
    Cache_Logs.setType(guildId, type, { enabled, channelId: channel ? channel.id : null });
    client.utils.Embed(interaction, Colors.Blurple, 'Logs Setup', `Successfully ${enabled ? 'enabled' : 'disabled'} \`${type}\` logs`);
};