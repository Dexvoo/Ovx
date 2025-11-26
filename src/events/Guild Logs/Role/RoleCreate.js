const { Events, EmbedBuilder, Colors, PermissionFlagsBits, Role } = require('discord.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
  name: Events.GuildRoleCreate,
  once: false,
  nickname: 'Role Create | Logs',

  /**
   *
   * @param {import('../../../types.js').RoleUtils} role
   * @returns
   */

  async execute(role) {
    const { client, guild } = role;

    if (!guild) return;

    const LogsData = await LogsCache.get(guild.id);
    if (!LogsData)
      return client.utils.LogData('Role Created', `Guild: ${guild.name} | Disabled`, 'warning');

    const roleLogData = LogsData.role;
    if (!roleLogData || !roleLogData.enabled || roleLogData.channelId === null)
      return client.utils.LogData('Role Created', `Guild: ${guild.name} | Disabled`, 'warning');

    const logChannel = guild.channels.cache.get(roleLogData.channelId);
    if (!logChannel) {
      await LogsCache.setType(guild.id, 'role', { enabled: false, channelId: null });
      return client.utils.LogData(
        'Role Created',
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
      await LogsCache.setType(guild.id, 'role', { enabled: false, channelId: null });
      return client.utils.LogData(
        'Role Created',
        `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`,
        'error'
      );
    }

    const description = [`${role}`];

    const LogEmbed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(`Role Created`)
      .setDescription(description.join('\n'))
      .setFooter({ text: `RID: ${role.id}` })
      .setTimestamp();

    logChannel
      .send({ embeds: [LogEmbed] })
      .then(() =>
        client.utils.LogData('Role Created', `Guild: ${guild.name} | @${role.name} `, 'info')
      )
      .catch((err) =>
        client.utils.LogData(
          'Role Created',
          `Guild: ${guild.name} | Failed to send log message: ${err.message}`,
          'error'
        )
      );
  },
};
