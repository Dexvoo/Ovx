const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType, LevelReward } = require('../../../models/GuildSetups');
const Cache_Levels = require('../../../cache/Levels');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 * @param {LevelReward} levelReward
 */
module.exports = async function RewardRemoveSetting(interaction, context) {
  const { client, options, guildId, memberPermissions } = interaction;
  const { LevelConfigData } = context;

  const level = options.getInteger('level');
  const role = options.getRole('role');

  if (!LevelConfigData.enabled)
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Failed Settings',
      'Levels are currently not enabled on this server.\nAsk a server admin to use `/level setup`'
    );
  if (!memberPermissions.has(PermissionsBitField.Flags.ManageGuild))
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Failed Setup',
      'User Missing Permissions | \`ManageGuild\`'
    );

  if (!level && !role)
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Failed Settings',
      `Please provide a level or role to remove as a level reward`
    );
  if (LevelConfigData.rewards.length === 0)
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Levels Settings',
      `There is no level rewards to remove`
    );

  if (level) {
    if (!LevelConfigData.rewards.some((reward) => reward.level === level))
      return client.utils.Embed(
        interaction,
        Colors.Red,
        'Failed Settings',
        `\`${level}\` does not exist in the level rewards`
      );

    LevelConfigData.rewards = LevelConfigData.rewards.filter((reward) => reward.level !== level);
    await Cache_Levels.setType(guildId, 'rewards', LevelConfigData.rewards);
    client.utils.Embed(
      interaction,
      Colors.Blurple,
      'Levels Settings',
      `Successfully set removed level reward for level \`${level}\``
    );
  } else {
    if (!role || role.guild.id !== guildId)
      return client.utils.Embed(
        interaction,
        Colors.Red,
        'Failed Settings',
        `${role} is not from this server.`
      );
    if (!LevelConfigData.rewards.some((reward) => reward.roleId === role.id))
      return client.utils.Embed(
        interaction,
        Colors.Red,
        'Failed Settings',
        `${role} does not exist in the level rewards`
      );

    LevelConfigData.rewards = LevelConfigData.rewards.filter((reward) => reward.roleId !== role.id);

    await Cache_Levels.setType(guildId, 'rewards', LevelConfigData.rewards);
    client.utils.Embed(
      interaction,
      Colors.Blurple,
      'Levels Settings',
      `Successfully set removed level reward for role ${role}`
    );
  }
};
