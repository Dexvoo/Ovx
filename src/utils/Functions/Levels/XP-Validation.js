const LevelsConfigCache = require('../../../cache/Levels.js');
const { PermissionFlagsBits } = require('discord.js');

/**
 * Performs all preliminary checks for granting XP.
 * @param {import('../../../types.js').MemberUtils} member
 * @param {import('../../../types.js').ChannelUtils} triggerChannel - The channel where the event occurred.
 * @returns {Promise<{levelConfig: import('../../../models/GuildSetups.js').LevelConfigType, levelUpChannel: import('../../../types.js').ChannelUtils}|null>}
 */
async function validateXPPreconditions(member, triggerChannel) {
  const { client, guild } = member;

  const levelConfig = await LevelsConfigCache.get(guild.id);
  if (!levelConfig?.enabled || !levelConfig.channelId) {
    if (levelConfig && !levelConfig.enabled) {
      client.utils.LogData('XP Pre-Check', `Guild: ${guild.name} | Levels disabled.`, 'warning');
    }
    return null;
  }

  const levelUpChannel = guild.channels.cache.get(levelConfig.channelId);
  if (!levelUpChannel) {
    client.utils.LogData(
      'XP Pre-Check',
      `Guild: ${guild.name} | Level-up channel not found.`,
      'error'
    );
    return null;
  }

  const botPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ];
  const [hasPerms] = client.utils.PermCheck(levelUpChannel, botPermissions, client);
  if (!hasPerms) {
    client.utils.LogData(
      'XP Pre-Check',
      `Guild: ${guild.name} | Missing permissions in level-up channel.`,
      'error'
    );
    return null;
  }

  if (isBlacklisted(member, triggerChannel, levelConfig)) {
    return null;
  }

  return { levelConfig, levelUpChannel };
}

/**
 * @param {import('../../../types.js').MemberUtils} member
 * @param {import('../../../types.js').ChannelUtils} channel
 * @param {import('../../../models/GuildSetups.js').LevelConfigType} config
 * @returns {boolean}
 */
function isBlacklisted(member, channel, config) {
  const { client } = channel;
  if (!config.blacklisted) return false;

  const hasBlacklistedRole = config.blacklisted.roleIds?.some((roleId) =>
    member.roles.cache.has(roleId)
  );
  const isBlacklistedChannel = config.blacklisted.channelIds?.includes(channel.id);

  if (hasBlacklistedRole) {
    client.utils.LogData(
      'XP Blacklist',
      `Guild: ${member.guild.name} | User: @${member.user.username} | Has blacklisted role`,
      'info'
    );
    return true;
  }

  if (isBlacklistedChannel) {
    client.utils.LogData(
      'XP Blacklist',
      `Guild: ${member.guild.name} | Channel: #${channel.name} | Is a blacklisted channel`,
      'info'
    );
    return true;
  }

  return false;
}

module.exports = { validateXPPreconditions };
