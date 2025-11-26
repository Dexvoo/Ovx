const { Events, EmbedBuilder, Colors } = require('discord.js');
require('dotenv').config();

const { DevGuildID, LeaveGuildLogCID } = process.env;

module.exports = {
  name: Events.GuildDelete,
  once: false,
  nickname: 'Guild Leave Logs',

  /**
   * @param {import('../../types').GuildUtils} guild - Discord Guild
   */
  async execute(guild) {
    const { client, name, id, ownerId } = guild;

    try {
      if (!name) return;

      const Embed = new EmbedBuilder()
        .setTitle('Guild Left')
        .setColor(Colors.Red)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .addFields(
          { name: 'Guild', value: `${name} (\`${id}\`)`, inline: false },
          { name: 'Owner', value: `<@${ownerId}>`, inline: true },
          {
            name: 'Members',
            value: guild.memberCount.toLocaleString() || 'Unknown',
            inline: true,
          }
        )
        .setTimestamp();

      await client.utils.EmbedDev('leaveGuild', client, Embed);
    } catch (error) {
      client.utils.LogData(
        'Guild Leave Logs',
        `Failed to process event: ${error.message}`,
        'error'
      );
    }
  },
};
