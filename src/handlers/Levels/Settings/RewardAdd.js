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
module.exports = async function RewardAddSetting(interaction, context) {
    const { client, options, guildId, memberPermissions, guild } = interaction;
    const { LevelConfigData } = context
    
    const level = options.getInteger('level') || 1;
    const role = options.getRole('role');
    
    if(!LevelConfigData.enabled) return SendEmbed(interaction, Colors.Red, 'Failed Settings', 'Levels are currently not enabled on this server.\nAsk a server admin to use `/level setup`', []);
    if(!memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) return SendEmbed(interaction, Colors.Red, 'Failed Setup', 'User Missing Permissions | \`ManageGuild\`', []);

    if(level > LevelConfigData.maxLevel) return SendEmbed(interaction, Colors.Red, 'Failed Settings', `Target level (${level}) is above max guild level (${LevelConfigData.maxLevel})`, []);
    if(!role || role.guild.id !== guildId) return SendEmbed(interaction, Colors.Red, 'Failed Settings', `${role} is not from this server.`, []);
    if(role.position >= guild.members.me.roles.highest.position) return SendEmbed(interaction, Colors.Red, 'Failed Settings', 'Bot Missing Permissions | \`RoleHierarchy\`', []);



    if(LevelConfigData.rewards.length === 0) {
        await Cache_Levels.setType(guildId, 'rewards', { level, roleId: role.id });
        return SendEmbed(interaction, Colors.Blurple, 'Levels Settings', `Successfully set added level reward for ${role} at level \`${level}\``);
    }

    if (!Array.isArray(LevelConfigData.rewards)) {
    LevelConfigData.rewards = LevelConfigData.rewards ? [LevelConfigData.rewards] : [];
}

    console.log(LevelConfigData.rewards)
    // { level: 1, roleId: '1325110303440244758' }
    if(LevelConfigData.rewards.some(reward => reward.roleId === role.id)) return SendEmbed(interaction, Colors.Red, 'Failed Settings', `${role} already exists in the level rewards`, []);
    if(LevelConfigData.rewards.some(reward => reward.level === level)) return SendEmbed(interaction, Colors.Red, 'Failed Settings', `${level} already has a role assigned`, []);

    LevelConfigData.rewards.push({ level: level, roleId: role.id })

    await Cache_Levels.setType(guildId, 'rewards', LevelConfigData.rewards);
    SendEmbed(interaction, Colors.Blurple, 'Levels Settings', `Successfully set added level reward for ${role} at level \`${level}\``);
};