const { Colors, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const { LogsConfigType } = require('../../models/GuildSetups');
const Cache_Logs = require('../../cache/Logs');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function LogsSetup(interaction) {
  const { client, options, guildId } = interaction;

  const type = options.getString('log-type');
  const enabled = options.getBoolean('enabled');
  const channel = options.getChannel('channel') || null;

  if (type === 'server') {
    return client.utils.Embed(
      interaction,
      Colors.Blurple,
      `Failed Setup | Unavailable`,
      `Server logs will be coming soon!`
    );
  }

  if (!channel && enabled) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Failed Setup',
      'Please provide a channel to send the logs to'
    );
  }

  if (enabled) {
    const botPermissionsInMessage = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ];
    const [hasMessagePermissions, missingMessagePermissions] = client.utils.PermCheck(
      channel,
      botPermissionsInMessage,
      client
    );

    if (!hasMessagePermissions) {
      return client.utils.Embed(
        interaction,
        Colors.Red,
        'Failed Setup',
        `Bot Missing Permissions | \`${missingMessagePermissions.join(', ')}\` in ${channel}`
      );
    }

    try {
      const testEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle('Test Log')
        .setDescription(`This is a test log for \`${type}\` logs`)
        .setFooter({
          text: `Tested by @${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await channel.send({ embeds: [testEmbed] });
    } catch (error) {
      console.error('Failed to send test log:', error);
      return client.utils.Embed(
        interaction,
        Colors.Red,
        'Failed Setup',
        `Failed to send a test log in ${channel}. Please check my permissions again.`
      );
    }
  }

  const settings = { enabled, channelId: channel ? channel.id : null };

  try {
    if (type === 'all') {
      const allTypes = Object.keys(LogsConfigType.obj).filter((key) => key !== 'guildId');
      const updatePromises = allTypes.map((logType) =>
        Cache_Logs.setType(guildId, logType, settings)
      );

      await Promise.all(updatePromises);
    } else {
      await Cache_Logs.setType(guildId, type, settings);
    }
  } catch (error) {
    console.error('Failed to update log settings:', error);
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Error',
      'An error occurred while saving the settings.'
    );
  }

  client.utils.Embed(
    interaction,
    Colors.Blurple,
    'Logs Setup',
    `Successfully ${enabled ? 'enabled' : 'disabled'} \`${type}\` logs.`
  );
};
