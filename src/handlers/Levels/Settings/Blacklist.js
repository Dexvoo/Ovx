const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups');
const Cache_Levels = require('../../../cache/Levels');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function LevelBlacklist(interaction, context) {
  const { client, options, guildId, memberPermissions } = interaction;
  let { LevelConfigData } = context;

  // --- Initial Checks ---
  if (!LevelConfigData.enabled) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Failed',
      'Levels are not enabled. Use `/level setup` first.'
    );
  }
  if (!memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Failed',
      'You need the `Manage Server` permission to use this command.'
    );
  }

  const role = options.getRole('role');
  const channel = options.getChannel('channel');

  if (!role && !channel) {
    // If neither is provided, show the current blacklist.
    const { roleIds = [], channelIds = [] } = LevelConfigData.blacklisted || {};

    const roleMentions = roleIds.map((id) => `<@&${id}>`).join(', ') || 'None';
    const channelMentions = channelIds.map((id) => `<#${id}>`).join(', ') || 'None';

    const fields = [
      { name: 'Blacklisted Roles', value: roleMentions },
      { name: 'Blacklisted Channels', value: channelMentions },
    ];

    return client.utils.Embed(interaction, Colors.Blurple, 'Current Level Blacklist', '', {
      fields,
    });
  }

  // Ensure the blacklist object and its arrays exist.
  if (!LevelConfigData.blacklisted) LevelConfigData.blacklisted = { roleIds: [], channelIds: [] };
  if (!LevelConfigData.blacklisted.roleIds) LevelConfigData.blacklisted.roleIds = [];
  if (!LevelConfigData.blacklisted.channelIds) LevelConfigData.blacklisted.channelIds = [];

  const responses = [];
  let changesMade = false;

  // --- Handle Role Blacklist ---
  if (role) {
    const isAlreadyBlacklisted = LevelConfigData.blacklisted.roleIds.includes(role.id);

    if (isAlreadyBlacklisted) {
      // Remove the role
      LevelConfigData.blacklisted.roleIds = LevelConfigData.blacklisted.roleIds.filter(
        (id) => id !== role.id
      );
      responses.push(`✅ Removed ${role} from the XP blacklist.`);
    } else {
      // Add the role
      LevelConfigData.blacklisted.roleIds.push(role.id);
      responses.push(`❌ Added ${role} to the XP blacklist.`);
    }
    changesMade = true;
  }

  // --- Handle Channel Blacklist ---
  if (channel) {
    const isAlreadyBlacklisted = LevelConfigData.blacklisted.channelIds.includes(channel.id);

    if (isAlreadyBlacklisted) {
      // Remove the channel
      LevelConfigData.blacklisted.channelIds = LevelConfigData.blacklisted.channelIds.filter(
        (id) => id !== channel.id
      );
      responses.push(`✅ Removed ${channel} from the XP blacklist.`);
    } else {
      // Add the channel
      LevelConfigData.blacklisted.channelIds.push(channel.id);
      responses.push(`❌ Added ${channel} to the XP blacklist.`);
    }
    changesMade = true;
  }

  // --- Save Changes and Respond ---
  if (changesMade) {
    await Cache_Levels.setType(guildId, 'blacklisted', LevelConfigData.blacklisted);
  }

  await client.utils.Embed(
    interaction,
    Colors.Blurple,
    'Levels Blacklist Updated',
    responses.join('\n')
  );
};
