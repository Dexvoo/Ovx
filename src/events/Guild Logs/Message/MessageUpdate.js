const { Events, EmbedBuilder, Colors, PermissionFlagsBits } = require('discord.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
  name: Events.MessageUpdate,
  once: false,
  nickname: 'Message Update | Logs',

  /**
   * @param {import('../../../types.js').MessageUtils} oldMessage
   * @param {import('../../../types.js').MessageUtils} newMessage
   */
  async execute(oldMessage, newMessage) {
    const { client, guild, channel, author } = newMessage;

    if (author?.bot || !guild) return;

    const oldContent = oldMessage.partial ? '*Unavailable (Uncached)*' : oldMessage.content;
    const newContent = newMessage.content;

    if (!oldMessage.partial && oldContent === newContent) return;

    const LogsData = await LogsCache.get(guild.id);
    if (!LogsData || LogsData.ignoredChannels?.includes(channel.id)) return;

    const messageLogData = LogsData.message;
    if (!messageLogData || !messageLogData.enabled || !messageLogData.channelId) return;

    const logChannel = guild.channels.cache.get(messageLogData.channelId);
    if (!logChannel) return;

    const [hasPermission] = client.utils.PermCheck(
      logChannel,
      [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
      ],
      client
    );
    if (!hasPermission) return;

    const description = [
      `**Old Content:**\n${oldContent ? oldContent.substring(0, 1750) : 'None'}`,
      `**New Content:**\n${newContent ? newContent.substring(0, 1750) : 'None'}`,
    ];

    const LogEmbed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setAuthor({
        name: author.username,
        iconURL: author.displayAvatarURL({ size: 512, extension: 'png' }),
      })
      .setTitle(`Message Updated in #${channel.name}`)
      .setURL(newMessage.url)
      .setDescription(description.join('\n'))
      .setFooter({ text: `UID: ${author.id} | MID: ${newMessage.id}` })
      .setTimestamp();

    logChannel.send({ embeds: [LogEmbed] }).catch(() => {});
  },
};
