const { Colors, PermissionFlagsBits } = require('discord.js');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function UserInfo(interaction) {
  const { client, guild } = interaction;
  const targetUser = interaction.options.getUser('target') || interaction.user;

  // Defer the reply
  await interaction.deferReply();

  const member = await guild.members.fetch(targetUser.id).catch(() => null);

  const userFlags = targetUser.flags.toArray();
  const roles = member
    ? member.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.toString())
    : [];

  const fields = [
    { name: 'ID', value: `\`${targetUser.id}\``, inline: true },
    { name: 'Type', value: targetUser.bot ? '🤖 Bot' : '👤 Human', inline: true },
    { name: 'Created', value: client.utils.Timestamp(targetUser.createdAt, 'F'), inline: true },
  ];

  if (member) {
    fields.push(
      {
        name: 'Joined Server',
        value: client.utils.Timestamp(member.joinedAt, 'F'),
        inline: true,
      },
      {
        name: 'Nickname',
        value: member.nickname ? `\`${member.nickname}\`` : 'None',
        inline: true,
      },
      { name: 'Highest Role', value: member.roles.highest.toString(), inline: true },
      {
        name: `Roles (${roles.length})`,
        value:
          roles.length > 0
            ? roles.slice(0, 5).join(', ') +
              (roles.length > 5 ? ` **+${roles.length - 5} more**` : '')
            : 'None',
        inline: false,
      }
    );
  }

  if (userFlags.length > 0) {
    fields.push({ name: 'Badges', value: userFlags.join(', '), inline: false });
  }

  await client.utils.Embed(interaction, Colors.Blurple, '', '', {
    author: { name: targetUser.tag, iconURL: targetUser.displayAvatarURL() },
    thumbnail: { url: targetUser.displayAvatarURL({ size: 256 }) },
    fields: fields,
    footer: { text: `Requested by ${interaction.user.tag}` },
  });
};
