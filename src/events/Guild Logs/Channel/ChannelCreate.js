const { Events, EmbedBuilder, Colors, PermissionFlagsBits, GuildChannel } = require('discord.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
  name: Events.ChannelCreate,
  once: false,
  nickname: 'Channel Created | Logs',

  /**
   *
   * @param {import('../../../types.js').ChannelUtils} channel
   */

  async execute(channel) {
    const { client, guild } = channel;

    if (!guild) return;

    const LogsData = await LogsCache.get(guild.id);
    if (!LogsData || !LogsData?.channel?.enabled || !LogsData?.channel?.channelId)
      return client.utils.LogData('Channel Created', `Guild: ${guild.name} | Disabled`, 'warning');

    const logChannel = guild.channels.cache.get(LogsData.channel.channelId);
    if (!logChannel) {
      await LogsCache.setType(guild.id, 'channel', { enabled: false, channelId: null });
      return client.utils.LogData(
        'Channel Created',
        `Guild: ${guild.name} | Log Channel not found, disabling logs`,
        'error'
      );
    }

    const botPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ];
    const [hasPermission, missingPermissions] = client.utils.PermCheck(
      logChannel,
      botPermissions,
      client
    );
    if (!hasPermission) {
      await LogsCache.setType(guild.id, 'channel', { enabled: false, channelId: null });
      return client.utils.LogData(
        'Channel Created',
        `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`,
        'error'
      );
    }

    const description = [`${channel}`];

    const LogEmbed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(`Channel Created`)
      .setDescription(description.join('\n'))
      .setFooter({ text: `CID: ${channel.id}` })
      .setTimestamp();

    logChannel
      .send({ embeds: [LogEmbed] })
      .then(() =>
        client.utils.LogData(
          'Channel Created',
          `Guild: ${guild.name} | Channel created in #${channel.name}`,
          'info'
        )
      )
      .catch((err) =>
        client.utils.LogData(
          'Channel Created',
          `Guild: ${guild.name} | Failed to send log message: ${err.message}`,
          'error'
        )
      );
  },
};
