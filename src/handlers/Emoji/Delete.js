const { Colors, parseEmoji } = require('discord.js');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function EmojiDelete(interaction) {
    const { client, guild, options } = interaction;
    const emojiString = options.getString('emoji');

    const parsed = parseEmoji(emojiString);
    if (!parsed || !parsed.id) {
        return client.utils.Embed(interaction, Colors.Red, 'Invalid Emoji', 'Please provide a valid custom emoji from this server.');
    }

    const emoji = guild.emojis.cache.get(parsed.id);
    if (!emoji) {
        return client.utils.Embed(interaction, Colors.Red, 'Not Found', 'That emoji does not belong to this server.');
    }

    try {
        await emoji.delete(`Deleted by ${interaction.user.tag}`);
        await client.utils.Embed(interaction, Colors.Green, 'Emoji Deleted', `Successfully deleted the emoji \`${emoji.name}\`.`);
    } catch (error) {
        console.error(`Failed to delete emoji ${emoji.name}:`, error);
        await client.utils.Embed(interaction, Colors.Red, 'Error', `An error occurred while deleting the emoji. I may be missing permissions.`);
    }
};