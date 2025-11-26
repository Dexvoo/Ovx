const { Colors, parseEmoji } = require('discord.js');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function EmojiEdit(interaction) {
  const { client, guild, options } = interaction;
  const emojiString = options.getString('emoji');
  const newName = options.getString('name');

  const parsed = parseEmoji(emojiString);
  if (!parsed || !parsed.id) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Invalid Emoji',
      'Please provide a valid custom emoji from this server.'
    );
  }

  const emoji = guild.emojis.cache.get(parsed.id);
  if (!emoji) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Not Found',
      'That emoji does not belong to this server.'
    );
  }

  if (newName.length < 2 || newName.length > 32) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Invalid Name',
      'Emoji names must be between 2 and 32 characters long.'
    );
  }

  try {
    const oldName = emoji.name;
    const updatedEmoji = await emoji.edit({ name: newName });
    await client.utils.Embed(
      interaction,
      Colors.Green,
      'Emoji Edited',
      `Successfully renamed ${updatedEmoji} from \`${oldName}\` to \`${updatedEmoji.name}\`.`
    );
  } catch (error) {
    console.error(`Failed to edit emoji ${emoji.name}:`, error);
    await client.utils.Embed(
      interaction,
      Colors.Red,
      'Error',
      `An error occurred while editing the emoji. I may be missing permissions.`
    );
  }
};
