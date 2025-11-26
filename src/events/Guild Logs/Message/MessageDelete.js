const { Events, EmbedBuilder, Colors, PermissionFlagsBits } = require('discord.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
  name: Events.MessageDelete,
  once: false,
  nickname: 'Channel Delete | Logs',

  /**
   *
   * @param {import('../../../types.js').MessageUtils} message
   * @returns
   */

  async execute(message) {
    const { client, guild, channel, content, author } = message;

    if (author.bot || !guild) return;

    const LogsData = await LogsCache.get(guild.id);
    if (!LogsData)
      return client.utils.LogData('Message Deleted', `Guild: ${guild.name} | Disabled`, 'warning');

    if (LogsData.ignoredChannels?.includes(channel.id)) return;

    const messageLogData = LogsData.message;
    if (!messageLogData || !messageLogData.enabled || messageLogData.channelId === null)
      return client.utils.LogData('Member Left', `Guild: ${guild.name} | Disabled`, 'warning');

    const logChannel = guild.channels.cache.get(messageLogData.channelId);
    if (!logChannel) {
      await LogsCache.setType(guild.id, 'message', { enabled: false, channelId: null });
      return client.utils.LogData(
        'Message Deleted',
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
        'Message Deleted',
        `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`,
        'error'
      );
    }

    const attachments = message.attachments.map((attachment) => attachment.url).join('\n');
    const description = [`-# ${content ? content.substring(0, 2000) : 'No content'}\n`];

    if (attachments) description.push(`### Attachments:\n${attachments}`);

    const LogEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setAuthor({
        name: author.username,
        iconURL: author.displayAvatarURL({ size: 512, extension: 'png' }),
      })
      .setTitle(`Message Deleted in #${channel.name}`)
      .setDescription(description.join('\n'))
      .setFooter({ text: `UID: ${author.id} | MID: ${message.id}` })
      .setTimestamp();

    logChannel
      .send({ embeds: [LogEmbed] })
      .then(() =>
        client.utils.LogData(
          'Message Deleted',
          `Guild: ${guild.name} | Message by ${author.tag} deleted in #${channel.name}`,
          'info'
        )
      )
      .catch((err) =>
        client.utils.LogData(
          'Message Deleted',
          `Guild: ${guild.name} | Failed to send log message: ${err.message}`,
          'error'
        )
      );
  },
};
