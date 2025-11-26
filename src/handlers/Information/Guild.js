const { Colors, GuildVerificationLevel, GuildExplicitContentFilter } = require('discord.js');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function GuildInfo(interaction) {
  const { client, guild } = interaction;
  await guild.members.fetch(); // Ensure member cache is populated

  const owner = await guild.fetchOwner();

  const fields = [
    { name: 'Owner', value: owner.toString(), inline: true },
    { name: 'ID', value: `\`${guild.id}\``, inline: true },
    { name: 'Created', value: client.utils.Timestamp(guild.createdAt, 'F'), inline: true },
    {
      name: 'Verification',
      value: `\`${GuildVerificationLevel[guild.verificationLevel]}\``,
      inline: true,
    },
    {
      name: 'Content Filter',
      value: `\`${GuildExplicitContentFilter[guild.explicitContentFilter]}\``,
      inline: true,
    },
    {
      name: 'Boost Level',
      value: `Tier ${guild.premiumTier} (${guild.premiumSubscriptionCount} boosts)`,
      inline: true,
    },
    {
      name: 'Members',
      value: `Total: ${guild.memberCount}\nHumans: ${guild.members.cache.filter((m) => !m.user.bot).size}\nBots: ${guild.members.cache.filter((m) => m.user.bot).size}`,
      inline: true,
    },
    {
      name: 'Channels',
      value: `Total: ${guild.channels.cache.size}\nText: ${guild.channels.cache.filter((c) => c.isTextBased()).size}\nVoice: ${guild.channels.cache.filter((c) => c.isVoiceBased()).size}`,
      inline: true,
    },
    { name: 'Roles', value: `\`${guild.roles.cache.size}\``, inline: true },
  ];

  await client.utils.Embed(interaction, Colors.Blurple, '', '', {
    author: { name: guild.name, iconURL: guild.iconURL() },
    thumbnail: { url: guild.iconURL({ size: 256 }) },
    image: { url: guild.bannerURL({ size: 512 }) },
    fields: fields,
  });
};
