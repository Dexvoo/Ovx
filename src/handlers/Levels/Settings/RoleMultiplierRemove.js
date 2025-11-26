const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups');
const Cache_Levels = require('../../../cache/Levels');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function RoleMultiplierRemove(interaction, context) {
  const { client, options, guildId, memberPermissions } = interaction;
  const { LevelConfigData } = context;

  if (!LevelConfigData.enabled)
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Failed',
      'Levels are not enabled. Use `/level setup` first.'
    );
  if (!memberPermissions.has(PermissionsBitField.Flags.ManageGuild))
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Failed',
      'You need the `Manage Server` permission to use this command.'
    );

  const role = options.getRole('role');

  if (
    !Array.isArray(LevelConfigData.roleMultipliers) ||
    !LevelConfigData.roleMultipliers.some((rm) => rm.roleId === role.id)
  ) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Not Found',
      `The ${role} role does not have an XP multiplier configured.`
    );
  }

  const updatedMultipliers = LevelConfigData.roleMultipliers.filter((rm) => rm.roleId !== role.id);
  await Cache_Levels.set(guildId, { roleMultipliers: updatedMultipliers });

  return client.utils.Embed(
    interaction,
    Colors.Green,
    'Multiplier Removed',
    `Successfully removed the XP multiplier from the ${role} role.`
  );
};
