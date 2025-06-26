const { Colors, ChatInputCommandInteraction, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups')
const Cache_Levels = require('../../../cache/Levels');

/**
 * @param {ChatInputCommandInteraction} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function MessageCooldownSetting(interaction, context) {
    const { client, options, guildId, memberPermissions } = interaction;
    const { LevelConfigData } = context
    
    const cooldown = options.getInteger('cooldown') || 20;
    if(!LevelConfigData.enabled) return client.utils.Embed(interaction, Colors.Red, 'Failed Settings', 'Levels are currently not enabled on this server.\nAsk a server admin to use `/level setup`', []);
    if(!memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', 'User Missing Permissions | \`ManageGuild\`', []);
    
    await Cache_Levels.setType(guildId, 'messageCooldown', cooldown);
    client.utils.Embed(interaction, Colors.Blurple, 'Levels Settings', `Successfully set guild message cooldown to ${cooldown} seconds`);
};