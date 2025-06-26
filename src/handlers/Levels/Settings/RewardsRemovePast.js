const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups')
const Cache_Levels = require('../../../cache/Levels');
require('dotenv').config()

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function RewardsRemovePastSetting(interaction, context) {
    const { client, options, guildId, memberPermissions } = interaction;
    const { LevelConfigData } = context
    
    const enabled = options.getBoolean('enabled') || false;
    if(!LevelConfigData.enabled) return client.utils.Embed(interaction, Colors.Red, 'Failed Settings', 'Levels are currently not enabled on this server.\nAsk a server admin to use `/level setup`');
    if(!memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', 'User Missing Permissions | \`ManageGuild\`');
    
    await Cache_Levels.setType(guildId, 'removePastRewards', enabled);
    client.utils.Embed(interaction, Colors.Blurple, 'Levels Settings', `Successfully set guild remove past rewards to \`${enabled}\``);
};