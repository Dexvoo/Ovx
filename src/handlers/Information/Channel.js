const { Colors, ChannelType } = require('discord.js');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function ChannelInfo(interaction) {
  const { client } = interaction;
  const channel = interaction.options.getChannel('target') || interaction.channel;

  const fields = [
    { name: 'Name', value: channel.name, inline: true },
    { name: 'ID', value: `\`${channel.id}\``, inline: true },
    { name: 'Type', value: `\`${ChannelType[channel.type]}\``, inline: true },
    { name: 'Created', value: client.utils.Timestamp(channel.createdAt, 'F'), inline: true },
    {
      name: 'Parent Category',
      value: channel.parent ? channel.parent.name : 'None',
      inline: true,
    },
    { name: 'Position', value: `\`${channel.position}\``, inline: true },
  ];

  if (channel.type === ChannelType.GuildText) {
    fields.push(
      { name: 'NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true },
      { name: 'Slowmode', value: `\`${channel.rateLimitPerUser}s\``, inline: true },
      { name: 'Topic', value: channel.topic ? `*${channel.topic}*` : 'None', inline: false }
    );
  } else if (channel.type === ChannelType.GuildVoice) {
    fields.push(
      { name: 'Bitrate', value: `\`${channel.bitrate / 1000}kbps\``, inline: true },
      {
        name: 'User Limit',
        value: channel.userLimit > 0 ? `\`${channel.userLimit}\`` : 'Unlimited',
        inline: true,
      }
    );
  }

  await client.utils.Embed(interaction, Colors.Blurple, `ℹ️ Channel Information`, '', { fields });
};
