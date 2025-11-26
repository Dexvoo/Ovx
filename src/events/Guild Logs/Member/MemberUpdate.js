const { Events, EmbedBuilder, Colors, PermissionFlagsBits } = require('discord.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
  name: Events.GuildMemberUpdate,
  once: false,
  nickname: 'Member Update | Logs',

  /**
   * @param {import('../../../types.js').MemberUtils} oldMember
   * @param {import('../../../types.js').MemberUtils} newMember
   */
  async execute(oldMember, newMember) {
    // [LOGIC FIX] Ignore partials.
    // If oldMember is partial, we don't know what their previous state was (roles, nick, etc.),
    // so we cannot accurately determine what changed.
    if (oldMember.partial) return;

    const { client, guild } = newMember;

    // Check if this is just a timeout change (handled by Timeouts.js)
    if (
      oldMember.communicationDisabledUntilTimestamp !==
        newMember.communicationDisabledUntilTimestamp &&
      oldMember.nickname === newMember.nickname &&
      oldMember.roles.cache.size === newMember.roles.cache.size
    ) {
      return;
    }

    if (!guild) return;

    const LogsData = await LogsCache.get(guild.id);
    if (!LogsData) return;

    const memberLogData = LogsData.member;
    if (!memberLogData || !memberLogData.enabled || !memberLogData.channelId) return;

    const logChannel = guild.channels.cache.get(memberLogData.channelId);
    if (!logChannel) {
      await LogsCache.setType(guild.id, 'member', { enabled: false, channelId: null });
      return client.utils.LogData(
        'Member Updated',
        `Guild: ${guild.name} | Log Channel not found`,
        'error'
      );
    }

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

    const LogEmbed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setAuthor({
        name: newMember.user.username,
        iconURL: newMember.user.displayAvatarURL({ size: 512, extension: 'png' }),
      })
      .setTitle(`${newMember.user.bot ? 'Bot' : 'Member'} Updated`)
      .setFooter({ text: `UID: ${newMember.id}` })
      .setTimestamp();

    // Nickname
    if (oldMember.nickname !== newMember.nickname) {
      LogEmbed.addFields({
        name: 'Nickname',
        value: `\`${oldMember.nickname || oldMember.displayName}\` → \`${newMember.nickname || newMember.displayName}\``,
        inline: false,
      });
    }

    // Server Avatar
    if (oldMember.avatar !== newMember.avatar) {
      LogEmbed.addFields({ name: 'Server Avatar', value: `Updated`, inline: false });
      LogEmbed.setThumbnail(newMember.avatar);
    }

    // Role changes
    const oldRoles = oldMember.roles.cache.map((r) => r.id);
    const newRoles = newMember.roles.cache.map((r) => r.id);
    const addedRoles = newRoles.filter((r) => !oldRoles.includes(r));
    const removedRoles = oldRoles.filter((r) => !newRoles.includes(r));

    if (addedRoles.length > 0) {
      LogEmbed.addFields({
        name: `Added Roles`,
        value: addedRoles
          .map((r) => `<@&${r}>`)
          .join(', ')
          .substring(0, 1024),
      });
    }
    if (removedRoles.length > 0) {
      LogEmbed.addFields({
        name: `Removed Roles`,
        value: removedRoles
          .map((r) => `<@&${r}>`)
          .join(', ')
          .substring(0, 1024),
      });
    }

    // Prevent sending empty embeds if we filtered out everything else
    if (LogEmbed.data.fields?.length === 0) return;

    logChannel
      .send({ embeds: [LogEmbed] })
      .catch((err) =>
        client.utils.LogData(
          'Member Updated',
          `Guild: ${guild.name} | Failed to send log: ${err.message}`,
          'error'
        )
      );
  },
};
