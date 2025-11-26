const {
  Events,
  EmbedBuilder,
  Colors,
  Message,
  PermissionFlagsBits,
  GuildChannel,
} = require('discord.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
  name: Events.MessageBulkDelete,
  once: false,
  nickname: 'Message Bulk Delete | Logs',

  /**
   *
   * @param {import('../../../types.js').MessageUtils} messages
   * @param {import('../../../types.js').ChannelUtils} channel
   * @returns
   */

  async execute(messages, channel) {
    const { client, guild } = channel;

    if (!guild) return;

    const LogsData = await LogsCache.get(guild.id);
    if (!LogsData)
      return client.utils.LogData(
        'Message Bulk Delete',
        `Guild: ${guild.name} | Disabled`,
        'warning'
      );

    if (LogsData.ignoredChannels?.includes(channel.id)) return;

    const messageLogData = LogsData.message;
    if (!messageLogData || !messageLogData.enabled || messageLogData.channelId === null)
      return client.utils.LogData('Member Left', `Guild: ${guild.name} | Disabled`, 'warning');

    const logChannel = guild.channels.cache.get(messageLogData.channelId);
    if (!logChannel) {
      await LogsCache.setType(guild.id, 'message', { enabled: false, channelId: null });
      return client.utils.LogData(
        'Message Bulk Delete',
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
      await LogsCache.setType(guild.id, 'message', { enabled: false, channelId: null });
      return client.utils.LogData(
        'Message Bulk Delete',
        `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`,
        'error'
      );
    }

    const description = [`${messages.size} messages`];

    const LogEmbed = new EmbedBuilder()
      .setColor(Colors.DarkRed)
      .setTitle(`Message Bulk Deleted in #${channel.name}`)
      .setURL(`https://discord.com/channels/${guild.id}/${channel.id}/${messages.last().id}`)
      .setDescription(description.join('\n'))
      .setFooter({ text: `CID: ${channel.id}` })
      .setTimestamp();

    logChannel
      .send({ embeds: [LogEmbed] })
      .then(() =>
        client.utils.LogData(
          'Message Bulk Deleted',
          `Guild: ${guild.name} | Message bulk deleted in #${channel.name}`,
          'info'
        )
      )
      .catch((err) =>
        client.utils.LogData(
          'Message Bulk Deleted',
          `Guild: ${guild.name} | Failed to send log message: ${err.message}`,
          'error'
        )
      );
  },
};
