const { Colors, version } = require('discord.js');
const os = require('os');
const moment = require('moment');
require('moment-duration-format');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function BotInfo(interaction) {
  const { client } = interaction;

  // Defer reply as gathering stats might take a moment
  await interaction.deferReply();

  const guilds = (await client.shard.fetchClientValues('guilds.cache.size')).reduce(
    (acc, count) => acc + count,
    0
  );
  const users = (
    await client.shard.broadcastEval((c) =>
      c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)
    )
  ).reduce((acc, count) => acc + count, 0);
  const channels = (await client.shard.fetchClientValues('channels.cache.size')).reduce(
    (acc, count) => acc + count,
    0
  );

  const uptime = moment.duration(client.uptime).format(' D [days], H [hrs], m [mins], s [secs]');

  const fields = [
    { name: 'Servers', value: `\`${guilds.toLocaleString()}\``, inline: true },
    { name: 'Users', value: `\`${users.toLocaleString()}\``, inline: true },
    { name: 'Channels', value: `\`${channels.toLocaleString()}\``, inline: true },
    { name: 'Uptime', value: uptime, inline: true },
    { name: 'Shard ID', value: `\`#${interaction.guild.shardId}\``, inline: true },
    { name: 'Ping', value: `\`${client.ws.ping}ms\``, inline: true },
    {
      name: 'Memory',
      value: `\`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\``,
      inline: true,
    },
    { name: 'Node.js', value: `\`${process.version}\``, inline: true },
    { name: 'Discord.js', value: `\`v${version}\``, inline: true },
  ];

  await client.utils.Embed(interaction, Colors.Blurple, '', '', {
    author: {
      name: `${client.user.username}'s Statistics`,
      iconURL: client.user.displayAvatarURL(),
    },
    fields: fields,
  });
};
