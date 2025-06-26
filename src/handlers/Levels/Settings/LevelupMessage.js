const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups')
const Cache_Levels = require('../../../cache/Levels');
require('dotenv').config()

/**
 * @param {import('../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function LevelupMessageSetting(interaction, context) {
    const { client, options, guildId, memberPermissions } = interaction;
    const { LevelConfigData } = context
    
    const levelupMessage = options.getString('message') || '{user}, you just gained a level! Current Level: **{level}**!';
    if(!LevelConfigData.enabled) return client.utils.Embed(interaction, Colors.Red, 'Failed Settings', 'Levels are currently not enabled on this server.\nAsk a server admin to use `/level setup`', []);
    if(!memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', 'User Missing Permissions | \`ManageGuild\`', []);
    
    await Cache_Levels.setType(guildId, 'levelUpMessage', levelupMessage);
    client.utils.Embed(interaction, Colors.Blurple, 'Levels Settings', `Successfully set guild level up message to \`${levelupMessage}\``);
};