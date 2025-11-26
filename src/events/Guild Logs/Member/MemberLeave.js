//--\events\Guild Logs\Member\MemberLeave.js
const { Events, EmbedBuilder, Colors, PermissionFlagsBits } = require('discord.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,
  nickname: 'Member Leave | Logs',

  /**
   * @param {import('../../../types.js').MemberUtils} member
   */
  async execute(member) {
    const { client, guild, user } = member;

    if (!guild) return;

    const LogsData = await LogsCache.get(guild.id);
    if (!LogsData) return;

    const leaveLogData = LogsData.leave;
    if (!leaveLogData || !leaveLogData.enabled || !leaveLogData.channelId) return;

    const logChannel = guild.channels.cache.get(leaveLogData.channelId);
    if (!logChannel) {
      await LogsCache.setType(guild.id, 'leave', { enabled: false, channelId: null });
      return client.utils.LogData(
        'Member Left',
        `Guild: ${guild.name} | Log Channel not found, disabling logs`,
        'error'
      );
    }

    let botMember = guild.members.me;
    if (!botMember) {
      try {
        botMember = await guild.members.fetchMe();
      } catch (err) {
        return client.utils.LogData(
          'Member Left',
          `Guild: ${guild.name} | Could not fetch bot member`,
          'error'
        );
      }
    }

    const botPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ];

    const [hasPermission] = client.utils.PermCheck(logChannel, botPermissions, botMember);
    if (!hasPermission) {
      await LogsCache.setType(guild.id, 'leave', { enabled: false, channelId: null });
      return client.utils.LogData(
        'Member Left',
        `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`,
        'error'
      );
    }

    const joinedAtString = member.joinedAt
      ? client.utils.Timestamp(member.joinedAt, 'R')
      : 'Unknown (Not cached)';

    const rolesList = member.roles?.cache
      ?.filter((role) => role.name !== '@everyone')
      .map((role) => role)
      .join(' • ');

    const description = [
      `${member} (${user.tag})`,
      `Joined: ${joinedAtString}`,
      `Roles: ${rolesList && rolesList.length > 0 ? rolesList.substring(0, 1024) : 'None'}`,
    ];

    const LogEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setAuthor({
        name: user.username,
        iconURL: user.displayAvatarURL({ size: 512, extension: 'png' }),
      })
      .setTitle(`${user.bot ? 'Bot' : 'Member'} Left`)
      .setDescription(description.join('\n'))
      .setFooter({ text: `UID: ${member.id}` })
      .setTimestamp();

    logChannel
      .send({ embeds: [LogEmbed] })
      .then(() =>
        client.utils.LogData(
          'Member Left',
          `Guild: ${guild.name} | ${user.bot ? '🤖 Bot' : '👤 User'} @${user.username}`,
          'info'
        )
      )
      .catch((err) =>
        client.utils.LogData(
          'Member Left',
          `Guild: ${guild.name} | Failed to send log message: ${err.message}`,
          'error'
        )
      );
  },
};
