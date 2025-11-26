const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups');
const Cache_XP = require('../../../cache/XP');
const { ExpForLevel, LevelForExp } = require('../../../utils/Functions/Levels/XPMathematics');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function LevelAdminSet(interaction, context) {
  const { client, options, guildId, memberPermissions } = interaction;
  const { LevelConfigData } = context;

  // Permission and setup checks
  if (!LevelConfigData.enabled)
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Failed',
      'Levels are currently not enabled on this server.\nAsk a server admin to use `/level setup`'
    );
  if (!memberPermissions.has(PermissionsBitField.Flags.ManageGuild))
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Failed',
      'User Missing Permissions | `ManageGuild`'
    );

  const targetUser = options.getUser('user');
  const levelToSet = options.getInteger('level');
  const xpToSet = options.getInteger('xp');

  if (levelToSet === null && xpToSet === null) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Invalid Input',
      'You must provide either a level or XP to set.'
    );
  }
  if (targetUser.bot) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Invalid Target',
      'Bots cannot have levels or XP.'
    );
  }

  try {
    const userXPData = await Cache_XP.get(guildId, targetUser.id);

    let newLevel = userXPData.level;
    let newXP = userXPData.xp; // XP within the current level

    if (levelToSet !== null) {
      if (levelToSet > LevelConfigData.maxLevel) {
        return client.utils.Embed(
          interaction,
          Colors.Red,
          'Failed',
          `The level provided (${levelToSet}) is higher than the server's max level (${LevelConfigData.maxLevel}).`
        );
      }
      newLevel = levelToSet;
      newXP = 0; // Reset XP within the level when setting a new level
    }

    if (xpToSet !== null) {
      const requiredForNext = ExpForLevel(newLevel + 1) - ExpForLevel(newLevel);
      if (xpToSet < 0 || xpToSet >= requiredForNext) {
        return client.utils.Embed(
          interaction,
          Colors.Red,
          'Invalid XP',
          `XP must be between 0 and ${requiredForNext - 1} for level ${newLevel}.`
        );
      }
      newXP = xpToSet;
    }

    // To ensure consistency, we reset the source XP fields when an admin manually sets a level/XP.
    // The new baseline becomes the total XP required for the new level plus the new XP within that level.
    const newTotalXP = ExpForLevel(newLevel) + newXP;

    await Cache_XP.set(guildId, targetUser.id, {
      level: newLevel,
      xp: newXP,
      messageXP: newTotalXP, // Set the total as the new messageXP baseline
      voiceXP: 0,
      dropsXP: 0,
    });

    Cache_XP.invalidate(guildId, targetUser.id); // Ensure the cache is updated on next read

    return client.utils.Embed(
      interaction,
      Colors.Green,
      'Success',
      `Successfully set ${targetUser}'s stats to:\n**Level:** \`${newLevel}\`\n**XP:** \`${newXP}\``
    );
  } catch (error) {
    console.error('Error in LevelAdminSet:', error);
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Error',
      "An unexpected error occurred while setting the user's level/XP."
    );
  }
};
