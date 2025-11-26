const { Colors } = require('discord.js');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function StickerList(interaction) {
  const { client, guild } = interaction;

  const stickers = [...guild.stickers.cache.values()];
  if (stickers.length === 0) {
    return client.utils.Embed(
      interaction,
      Colors.Orange,
      'No Stickers Found',
      'This server does not have any custom stickers.'
    );
  }

  const description = stickers
    .map((s) => `**${s.name}** - \`:${s.tags}:\`\n*${s.description || 'No description'}*`)
    .join('\n\n');

  await client.utils.Embed(
    interaction,
    Colors.Blurple,
    `${guild.name}'s Stickers (${stickers.length})`,
    description
  );
};
