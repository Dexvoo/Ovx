const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups');
const Cache_Levels = require('../../../cache/Levels');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function RoleMultiplierAdd(interaction, context) {
  const { client, options, guild, guildId, memberPermissions } = interaction;
  let { LevelConfigData } = context;

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
  const multiplier = options.getNumber('multiplier');

  if (role.position >= guild.members.me.roles.highest.position) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Hierarchy Error',
      `I cannot manage the role ${role} because it is higher than or equal to my highest role.`
    );
  }
  // if (role.managed) {
  //     return client.utils.Embed(interaction, Colors.Red, 'Invalid Role', 'I cannot assign a multiplier to a bot-managed role.');
  // }

  if (!Array.isArray(LevelConfigData.roleMultipliers)) {
    LevelConfigData.roleMultipliers = [];
  }

  const existingMultiplierIndex = LevelConfigData.roleMultipliers.findIndex(
    (rm) => rm.roleId === role.id
  );
  if (existingMultiplierIndex !== -1) {
    // Update existing multiplier
    const oldMultiplier = LevelConfigData.roleMultipliers[existingMultiplierIndex].multiplier;
    LevelConfigData.roleMultipliers[existingMultiplierIndex].multiplier = multiplier;
    await Cache_Levels.setType(guildId, 'roleMultipliers', LevelConfigData.roleMultipliers);
    return client.utils.Embed(
      interaction,
      Colors.Green,
      'Multiplier Updated',
      `Updated the XP multiplier for ${role} from \`x${oldMultiplier}\` to \`x${multiplier}\`.`
    );
  } else {
    // Add new multiplier
    LevelConfigData.roleMultipliers.push({ roleId: role.id, multiplier: multiplier });
    await Cache_Levels.setType(guildId, 'roleMultipliers', LevelConfigData.roleMultipliers);
    return client.utils.Embed(
      interaction,
      Colors.Green,
      'Multiplier Added',
      `Successfully set an XP multiplier of \`x${multiplier}\` for the ${role} role.`
    );
  }
};
