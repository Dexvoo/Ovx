const { Colors } = require('discord.js');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function EmojiList(interaction) {
    const { client, guild } = interaction;

    const emojis = [...guild.emojis.cache.values()];
    if (emojis.length === 0) {
        return client.utils.Embed(interaction, Colors.Orange, 'No Emojis Found', 'This server does not have any custom emojis.');
    }

    const staticEmojis = emojis.filter(e => !e.animated).map(e => e.toString());
    const animatedEmojis = emojis.filter(e => e.animated).map(e => e.toString());

    let staticStr = staticEmojis.join(' ');
    let animatedStr = animatedEmojis.join(' ');
    
    // Truncate if necessary to fit within embed field limits (1024 chars)
    if (staticStr.length > 1020) staticStr = staticStr.substring(0, 1017) + '...';
    if (animatedStr.length > 1020) animatedStr = animatedStr.substring(0, 1017) + '...';

    const fields = [];
    if (staticEmojis.length > 0) {
        fields.push({ name: `Static Emojis (${staticEmojis.length})`, value: staticStr });
    }
    if (animatedEmojis.length > 0) {
        fields.push({ name: `Animated Emojis (${animatedEmojis.length})`, value: animatedStr });
    }

    await client.utils.Embed(interaction, Colors.Blurple, `${guild.name}'s Emojis`, '', { fields });
};