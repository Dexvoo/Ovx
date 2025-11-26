const { Colors } = require('discord.js');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function StickerDelete(interaction) {
  const { client, guild, options } = interaction;
  const stickerId = options.getString('sticker');

  const sticker = guild.stickers.cache.get(stickerId);
  if (!sticker) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Not Found',
      'That sticker could not be found in this server.'
    );
  }

  try {
    await sticker.delete(`Deleted by ${interaction.user.tag}`);
    await client.utils.Embed(
      interaction,
      Colors.Green,
      'Sticker Deleted',
      `Successfully deleted the sticker \`${sticker.name}\`.`
    );
  } catch (error) {
    console.error(`Failed to delete sticker ${sticker.name}:`, error);
    await client.utils.Embed(
      interaction,
      Colors.Red,
      'Error',
      `An error occurred while deleting the sticker.`
    );
  }
};
