const { Events, Client } = require('discord.js');
const Global_Cache = require('../../cache/Global');
const { DevGuildID } = process.env;

module.exports = {
  name: Events.ClientReady,
  once: true,
  nickname: 'Client Presence',

  /**
   * @param {Client} client - Discord Client
   */

  async execute(client) {
    const shardId = await client.shard
      .broadcastEval(
        (c, { guildId }) =>
          c.guilds.cache.has(guildId) ? c.guilds.cache.get(guildId).shardId : null,
        { context: { guildId: DevGuildID } }
      )
      .then((results) => results.find((id) => id !== null));

    if (shardId !== null) {
      Global_Cache.DevSID = Number(shardId);
    } else {
      console.error(
        'Developer Shard ID not found. Please ensure the bot is in the developer guild.'
      );
      Global_Cache.DevSID = 0; // Fallback to 0 if not found
    }
  },
};
