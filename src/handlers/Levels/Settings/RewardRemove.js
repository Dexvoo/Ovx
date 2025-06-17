const { Colors, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { SendEmbed, ShortTimestamp } = require('../../../utils/LoggingData');
const { LevelConfigType, LevelReward } = require('../../../models/GuildSetups')
const { permissionCheck } = require('../../../utils/Permissions');
const Cache_Levels = require('../../../cache/Levels');
require('dotenv').config()

const { DeveloperIDs } = process.env;

/**
 * @param {ChatInputCommandInteraction} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 * @param {LevelReward} levelReward
 */
module.exports = async function RewardRemoveSetting(interaction, context) {
    const { client, options, guildId, memberPermissions } = interaction;
    const { LevelConfigData } = context
    
    const level = options.getInteger('level');
    const role = options.getRole('role');
    
    if(!LevelConfigData.enabled) return SendEmbed(interaction, Colors.Red, 'Failed Settings', 'Levels are currently not enabled on this server.\nAsk a server admin to use `/level setup`', []);
    if(!memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) return SendEmbed(interaction, Colors.Red, 'Failed Setup', 'User Missing Permissions | \`ManageGuild\`', []);

    if(!level && !role) return SendEmbed(interaction, Colors.Red, 'Failed Settings', `Please provide a level or role to remove as a level reward`, []);
    if(LevelConfigData.rewards.length === 0) return SendEmbed(interaction, Colors.Red, 'Levels Settings', `There is no level rewards to remove`);
    
    if(level) {
        if(!LevelConfigData.rewards.some(reward => reward.level === level)) return SendEmbed(interaction, Colors.Red, 'Failed Settings', `\`${level}\` does not exist in the level rewards`, []);

        console.log(LevelConfigData.rewards)
        LevelConfigData.rewards =  LevelConfigData.rewards.filter(reward => reward.level !== level);
        console.log(`LevelConfigData.rewards: ${LevelConfigData.rewards}`)
        await Cache_Levels.setType(guildId, 'rewards', LevelConfigData.rewards);
        SendEmbed(interaction, Colors.Blurple, 'Levels Settings', `Successfully set removed level reward for level \`${level}\``);

    } else {
        if(!role || role.guild.id !== guildId) return SendEmbed(interaction, Colors.Red, 'Failed Settings', `${role} is not from this server.`, []);
        if(!LevelConfigData.rewards.some(reward => reward.roleId === role.id)) return SendEmbed(interaction, Colors.Red, 'Failed Settings', `${role} does not exist in the level rewards`, []);

        LevelConfigData.rewards = LevelConfigData.rewards.filter(reward => reward.roleId !== role.id);

        await Cache_Levels.setType(guildId, 'rewards', LevelConfigData.rewards);
        SendEmbed(interaction, Colors.Blurple, 'Levels Settings', `Successfully set removed level reward for role ${role}`);
    }
};