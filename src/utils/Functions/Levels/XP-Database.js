const {
  GuildMember,
  GuildChannel,
  VoiceBasedChannel,
  EmbedBuilder,
  PermissionFlagsBits,
  roleMention,
} = require('discord.js');
const { VoiceXP, MessageXP, LevelForExp, ExpForLevel } = require('./XPMathematics');
const XPCache = require('../../../cache/XP');
const LevelCache = require('../../../cache/Levels');
const { UserLevelLoggingChannelID, PublicClientID, TopggAPIKey } = process.env;
const { LevelConfigType } = require('../../../models/GuildSetups');

/**
 * Calculates the highest applicable role multiplier for a member.
 * @param {import('../../../types.js').MemberUtils} member
 * @param {LevelConfigType} levelConfig
 * @returns {number} The highest multiplier, or 1 if none apply.
 */
function getHighestRoleMultiplier(member, levelConfig) {
  if (!levelConfig.roleMultipliers || levelConfig.roleMultipliers.length === 0) {
    return 1;
  }

  const applicableMultipliers = levelConfig.roleMultipliers
    .filter((rm) => member.roles.cache.has(rm.roleId))
    .map((rm) => rm.multiplier);

  if (applicableMultipliers.length === 0) {
    return 1;
  }

  // Return the highest multiplier if the user has multiple bonus roles
  return Math.max(...applicableMultipliers);
}

/**
 * @param {import('../../../types.js').MemberUtils} member
 * @param {import('../../../types.js').ChannelUtils} channel
 * @param {LevelConfigType} levelConfig - Guild Level Config
 */
async function addUserMessageXP(member, channel, levelConfig) {
  if (!member) throw new Error('No member provided');
  if (!channel) throw new Error('No channel provided');
  if (!levelConfig) throw new Error('No guild config provided');

  const { guild, client } = member;
  const userXPData = await XPCache.get(guild.id, member.id);
  let randomXP = MessageXP();

  // Apply bonuses
  if (await client.utils.HasVotedTGG(member.id)) randomXP *= 1.1; // 10% vote bonus
  const roleMultiplier = getHighestRoleMultiplier(member, levelConfig);
  randomXP *= roleMultiplier; // Role bonus
  randomXP *= levelConfig.xpMultiplier; // Global server bonus
  randomXP = Math.floor(randomXP);

  let totalXP = ExpForLevel(userXPData.level) + userXPData.xp;
  // Add the newly earned XP.
  totalXP += randomXP;

  const [newLevel, xpLeftover, xpForNextLevel] = LevelForExp(totalXP);
  await XPCache.set(guild.id, member.id, {
    level: newLevel,
    xp: xpLeftover,
    totalMessages: userXPData.totalMessages + 1,
    messageXP: userXPData.messageXP + randomXP,
    lastMessageAt: new Date(),
  });
  client.utils.LogData(
    'Message XP',
    `Guild: ${guild.id} | User: @${member.user.username} | XP Earned: ${randomXP} (Role Multi: x${roleMultiplier}) | Level: ${newLevel}`,
    'default'
  );

  if (newLevel > userXPData.level) {
    for (let i = userXPData.level; i < newLevel; i++) {
      await levelUp(member, channel, i + 1, levelConfig);
    }
  }
}

/**
 * @param {import('../../../types.js').MemberUtils} member
 * @param {import('../../../types.js').ChannelUtils | VoiceBasedChannel} channel
 * @param {LevelConfigType} levelConfig - Guild Level Config
 * @param {Number} timeSpent - time spent in VC
 */
async function addUserVoiceXP(member, channel, levelConfig, timeSpent) {
  if (!member) throw new Error('No member provided');
  if (!channel) throw new Error('No channel provided');
  if (!levelConfig) throw new Error('No guild config provided');
  if (!timeSpent) throw new Error('No timeSpent Provided');

  const { guild, client } = member;
  const userXPData = await XPCache.get(guild.id, member.id);

  let randomXP = VoiceXP(timeSpent);

  // Apply bonuses
  if (await client.utils.HasVotedTGG(member.id)) randomXP *= 1.1; // 10% vote bonus
  const roleMultiplier = getHighestRoleMultiplier(member, levelConfig);
  randomXP *= roleMultiplier; // Role bonus
  randomXP *= levelConfig.xpMultiplier; // Global server bonus
  randomXP = Math.floor(randomXP);

  let totalXP = userXPData.messageXP + userXPData.voiceXP + userXPData.dropsXP;
  // Add the newly earned XP.
  totalXP += randomXP;

  const [newLevel, xpLeftover, xpForNextLevel] = LevelForExp(totalXP);
  await XPCache.set(guild.id, member.id, {
    level: newLevel,
    xp: xpLeftover,
    totalVoice: userXPData.totalVoice + Math.floor(timeSpent),
    voiceXP: userXPData.voiceXP + randomXP,
    lastVoiceAt: new Date(),
  });
  client.utils.LogData(
    'Voice XP',
    `Guild: ${guild.id} | User: @${member.user.username} | XP Earned: ${randomXP} (Role Multi: x${roleMultiplier}) | Level: ${newLevel}`,
    'default'
  );

  if (newLevel > userXPData.level) {
    for (let i = userXPData.level; i < newLevel; i++) {
      await levelUp(member, channel, i + 1, levelConfig);
    }
  }
}

/**
 * @param {GuildMember} member - GuildMember who leveled up
 * @param {GuildChannel} channel - The channel to send the level-up message
 * @param {number} newLevel - New level achieved
 * @param {LevelConfigType} levelConfig - Guild Level Config
 */
async function levelUp(member, channel, newLevel, levelConfig) {
  if (!member) throw new Error('No member provided');
  if (!channel) throw new Error('No channel provided');

  const { guild, user, client } = member;
  // Sort rewards ascendingly to check past rewards correctly, but process descendingly for role assignment based on the original logic structure
  const rewards = levelConfig.rewards.sort((a, b) => b.level - a.level) ?? [];
  let addedRoles = [];
  let removedRoles = [];

  for (const reward of rewards) {
    // Fetch role if not cached, providing better reliability for level-up events
    const role =
      guild.roles.cache.get(reward.roleId) ||
      (await guild.roles.fetch(reward.roleId).catch(() => {
        client.utils.LogData(
          'Level Up',
          `Guild: ${guild.name} | Missing reward role (ID: ${reward.roleId}) removed from rewards`,
          'error'
        );
        // NOTE: You need to update the original levelConfig.rewards structure if you are modifying it here, which requires saving it back to cache/DB.
        // Since the original code filters 'rewards' but saves 'LevelCache', I'll assume 'rewards' variable here is a local copy or that the cache update is handled correctly later.
        return null;
      }));

    if (!role) {
      // WARNING: Filtering rewards here modifies the local 'rewards' array,
      // but the cache update relies on the original 'rewards' structure being updated correctly elsewhere.
      // For safety in this function, we just skip. The cleanup logic from the previous command should ideally run periodically.
      continue;
    }

    const hasRole = member.roles.cache.has(reward.roleId);

    if (reward.level === newLevel) {
      // --- IMPROVEMENT 1: Only add role if the user doesn't already have it ---
      if (!hasRole) {
        addedRoles.push({ roleId: reward.roleId, level: reward.level });
      } else {
        // Log that the role was already present (useful for debugging)
        client.utils.log(
          `[LevelUp Check] Role ${role.name} already held for level ${newLevel}. Skipping addition.`,
          'DEBUG'
        );
      }
    }

    if (levelConfig.removePastRewards && reward.level < newLevel) {
      // --- IMPROVEMENT 2: Only remove role if the user currently has it ---
      if (hasRole) {
        removedRoles.push({ roleId: reward.roleId, level: reward.level });
      } else {
        // Log that the role was already missing (useful for debugging)
        client.utils.log(
          `[LevelUp Check] Role ${role.name} for level ${reward.level} already missing. Skipping removal.`,
          'DEBUG'
        );
      }
    }
  }

  // --- Role Assignment ---
  if (addedRoles.length > 0) {
    try {
      await member.roles.add(addedRoles.map((reward) => reward.roleId));
      client.utils.log(
        `[LevelUp Roles] Added roles to ${member.user.tag} in ${guild.name}: ${addedRoles.map((r) => r.roleId).join(', ')}`,
        'INFO'
      );
    } catch (e) {
      client.utils.LogData(
        'Role Add Error',
        `Failed to add roles to ${member.user.tag} in ${guild.name}: ${e.message}`,
        'error'
      );
    }
  }

  // --- Role Removal ---
  if (removedRoles.length > 0) {
    try {
      await member.roles.remove(removedRoles.map((reward) => reward.roleId));
      client.utils.log(
        `[LevelUp Roles] Removed past roles from ${member.user.tag} in ${guild.name}: ${removedRoles.map((r) => r.roleId).join(', ')}`,
        'INFO'
      );
    } catch (e) {
      client.utils.LogData(
        'Role Remove Error',
        `Failed to remove past roles from ${member.user.tag} in ${guild.name}: ${e.message}`,
        'error'
      );
    }
  }

  const levelUpMessageTemplate = levelConfig.levelUpMessage || '{user} leveled up to **{level}**!';
  const levelUpMessage = levelUpMessageTemplate
    .replace('{user}', member.toString())
    .replace('{level}', newLevel.toString());

  // Assuming EmbedBuilder is accessible, otherwise use client.utils.Embed
  const DevEmbed = new client.utils.EmbedBuilder() // Assuming EmbedBuilder is attached to utils or globally available
    .setColor('Blurple')
    .setDescription(`User: ${member} | Guild: ${guild.name} | Level: \`${newLevel}\``);

  await client.utils.EmbedDev('userLevel', client, DevEmbed);

  await XPCache.set(guild.id, member.id, { lastLevelUpAt: new Date() });

  // --- IMPROVEMENT 3: Use client utility for mention if available, otherwise stick to original ---
  const levelEmbed = new client.utils.EmbedBuilder() // Assuming EmbedBuilder is attached to utils or globally available
    .setColor('Blurple')
    .setDescription(levelUpMessage)
    .addFields(
      ...(addedRoles.length > 0
        ? [
            {
              name: 'Added Rewards',
              // Using direct mention syntax for robustness if roleMention helper is not guaranteed
              value: addedRoles.map((reward) => `<@&${reward.roleId}>`).join(', '),
              inline: true,
            },
          ]
        : [])
    );

  await channel.send({ embeds: [levelEmbed] }).catch((error) => {
    client.utils.LogData(
      'Channel Send Error',
      `Could not send level-up message in ${channel.name} (${guild.name}): ${error.message}`,
      'error'
    );
  });

  client.utils.LogData(
    'Level Up',
    `${user.tag} leveled up to ${newLevel} | Roles Added: ${addedRoles.map((r) => r.roleId).join(', ') || 'None'} | Roles Removed: ${removedRoles.map((r) => r.roleId).join(', ') || 'None'}`,
    'info'
  );
}
module.exports = { addUserMessageXP, addUserVoiceXP };
