const { Colors, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { LevelConfig } = require('../../models/GuildSetups')
require('dotenv').config()

/**
 * @param {import('../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfig }} context
 */
module.exports = async function LevelsSetup(interaction) {
    const { client, options, guildId, memberPermissions } = interaction;
    
    const enabled = options.getBoolean('enabled');
    const channel = options.getChannel('setup-channel') || null;

    if(!memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', 'User Missing Permissions | \`ManageGuild\`');
    
    if(!channel && enabled) return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', 'Please provide a channel to send the level embed to');

    if(enabled) {
        const botPermissionsInMessage = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasMessagePermissions, missingMessagePermissions] = client.utils.PermCheck(channel, botPermissionsInMessage, client);
        if(!hasMessagePermissions) return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', `Bot Missing Permissions | \`${missingMessagePermissions.join(', ')}\` in ${channel}`);
        
        const testEmbed = new EmbedBuilder() 
            .setColor(Colors.Blurple)
            .setTitle('Test Levels')
            .setDescription(`This is a test embed for \`levels\``)
            .setFooter({ text: `Tested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        const sentMessage = await channel.send({ embeds: [testEmbed] });
        if(!sentMessage) return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', `Failed to send a test log in ${channel}`);
    };

    const Cache_Levels = require('../../cache/Levels');
    await Cache_Levels.setType(guildId, 'channelId', channel?.id);
    await Cache_Levels.setType(guildId, 'enabled', enabled);
    client.utils.Embed(interaction, Colors.Blurple, 'Levels Setup', `Successfully ${enabled ? 'enabled' : 'disabled'} levels`);
};