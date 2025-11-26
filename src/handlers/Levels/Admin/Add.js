const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups');
const Cache_XP = require('../../../cache/XP');
const { ExpForLevel, LevelForExp } = require('../../../utils/Functions/Levels/XPMathematics');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function LevelAdminAdd(interaction, context) {
  const { client, options, guildId, memberPermissions } = interaction;
  const { LevelConfigData } = context;

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
  const levelsToAdd = options.getInteger('levels') || 0;
  const xpToAdd = options.getInteger('xp') || 0;

  if (levelsToAdd <= 0 && xpToAdd <= 0) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Invalid Input',
      'You must provide a positive number of levels or XP to add.'
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
    const currentTotalXP = ExpForLevel(userXPData.level) + userXPData.xp;

    let newTotalXP = currentTotalXP + xpToAdd;

    if (levelsToAdd > 0) {
      const xpForLevels =
        ExpForLevel(userXPData.level + levelsToAdd) - ExpForLevel(userXPData.level);
      newTotalXP += xpForLevels;
    }

    const [finalLevel, finalXP] = LevelForExp(newTotalXP);

    if (finalLevel > LevelConfigData.maxLevel) {
      return client.utils.Embed(
        interaction,
        Colors.Red,
        'Failed',
        `This action would push the user beyond the server's max level of ${LevelConfigData.maxLevel}.`
      );
    }

    await Cache_XP.set(guildId, targetUser.id, {
      level: finalLevel,
      xp: finalXP,
    });

    return client.utils.Embed(
      interaction,
      Colors.Green,
      'Success',
      `Added **${levelsToAdd}** levels and **${xpToAdd}** XP to ${targetUser}.\nNew Stats:\n**Level:** \`${finalLevel}\`\n**XP:** \`${finalXP}\``
    );
  } catch (error) {
    console.error('Error in LevelAdminAdd:', error);
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Error',
      'An unexpected error occurred while adding level/XP.'
    );
  }
};
