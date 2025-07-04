const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType, LevelReward } = require('../../../models/GuildSetups')
const Cache_Levels = require('../../../cache/Levels');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 * @param {LevelReward} levelReward
 */
module.exports = async function RewardsListSetting(interaction, context) {
    const { client, options, guildId, memberPermissions, guild } = interaction;
    const { LevelConfigData } = context
    
    if(!LevelConfigData?.enabled) return client.utils.Embed(interaction, Colors.Red, 'Failed Settings', 'Levels are currently not enabled on this server.\nAsk a server admin to use `/level setup`');
    if(!memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) return client.utils.Embed(interaction, Colors.Red, 'Failed Setup', 'User Missing Permissions | \`ManageGuild\`');

    if(LevelConfigData.rewards?.length === 0) return client.utils.Embed(interaction, Colors.Red, 'Failed Settings', 'There is currently no level rewards setup');

    const rewards = await Promise.all(LevelConfigData.rewards.map(async (reward) => {
        const role = guild.roles.cache.get(reward.roleId);

        if (!role) {
            LevelConfigData.rewards = LevelConfigData.rewards.filter(r => r.roleId !== reward.roleId);
            await Cache_Levels.setType(guildId, 'rewards', LevelConfigData.rewards);
        }

        return `Level ${reward.level}: ${role ? role.toString() : 'Role not found'}`;
    }));

    client.utils.Embed(interaction, Colors.Blurple, 'Level Rewards', rewards.join('\n') || 'No rewards set')
};