const { Events, EmbedBuilder, Colors, PermissionFlagsBits } = require('discord.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
  name: Events.GuildMemberUpdate,
  once: false,
  nickname: 'Punishment Timeout | Logs',

  /**
   *
   * @param {import('../../../types.js').MemberUtils} oldMember
   * @param {import('../../../types.js').MemberUtils} newMember
   */

  async execute(oldMember, newMember) {
    const { client, guild } = newMember;

    if (!guild) return;

    if (
      oldMember.communicationDisabledUntilTimestamp !==
      newMember.communicationDisabledUntilTimestamp
    ) {
      const LogsData = await LogsCache.get(guild.id);
      if (!LogsData)
        return client.utils.LogData(
          'Punishment Timeout',
          `Guild: ${guild.name} | Disabled`,
          'warning'
        );

      const joinLogData = LogsData.punishment;
      if (!joinLogData || !joinLogData.enabled || joinLogData.channelId === null)
        return client.utils.LogData(
          'Punishment Timeout',
          `Guild: ${guild.name} | Disabled`,
          'warning'
        );

      const logChannel = guild.channels.cache.get(joinLogData.channelId);
      if (!logChannel) {
        await LogsCache.setType(guild.id, 'punishment', {
          enabled: false,
          channelId: null,
        });
        return client.utils.LogData(
          'Punishment Timeout',
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
        await LogsCache.setType(guild.id, 'punishment', {
          enabled: false,
          channelId: null,
        });
        return client.utils.LogData(
          'Punishment Timeout',
          `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`,
          'error'
        );
      }

      if (newMember.communicationDisabledUntilTimestamp === null) {
        const description = [`User: ${newMember}`];

        const LogEmbed = new EmbedBuilder()
          .setColor(Colors.DarkerGrey)
          .setAuthor({
            name: newMember.user.username,
            iconURL: newMember.user.displayAvatarURL({ size: 512, extension: 'png' }),
          })
          .setTitle(`${newMember.user.bot ? 'Bot' : 'Member'} Timeout Removed`)
          .setDescription(description.join('\n'))
          .setFooter({ text: `UID: ${newMember.id}` })
          .setTimestamp();

        logChannel
          .send({ embeds: [LogEmbed] })
          .then(() =>
            client.utils.LogData(
              'Punishment Timeout Removed',
              `Guild: ${guild.name} | ${newMember.user.bot ? '🤖 Bot' : '👤 User'} @${newMember.user.username}`,
              'info'
            )
          )
          .catch((err) =>
            client.utils.LogData(
              'Punishment Timeout Removed',
              `Guild: ${guild.name} | Failed to send log message: ${err.message}`,
              'error'
            )
          );
      } else {
        const description = [
          `User: ${newMember}`,
          `Timeout Until: ${client.utils.Timestamp(newMember.communicationDisabledUntil)}`,
        ];

        const LogEmbed = new EmbedBuilder()
          .setColor(Colors.LightGrey)
          .setAuthor({
            name: newMember.user.username,
            iconURL: newMember.user.displayAvatarURL({ size: 512, extension: 'png' }),
          })
          .setTitle(`${newMember.user.bot ? 'Bot' : 'Member'} Timed out`)
          .setDescription(description.join('\n'))
          .setFooter({ text: `UID: ${newMember.id}` })
          .setTimestamp();

        logChannel
          .send({ embeds: [LogEmbed] })
          .then(() =>
            client.utils.LogData(
              'Punishment Timeout Added',
              `Guild: ${guild.name} | ${newMember.user.bot ? '🤖 Bot' : '👤 User'} @${newMember.user.username}`,
              'info'
            )
          )
          .catch((err) =>
            client.utils.LogData(
              'Punishment Timeout Added',
              `Guild: ${guild.name} | Failed to send log message: ${err.message}`,
              'error'
            )
          );
      }
    }
  },
};
