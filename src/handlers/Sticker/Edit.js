const { Colors } = require('discord.js');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function StickerEdit(interaction) {
    const { client, guild, options } = interaction;
    const stickerId = options.getString('sticker');
    const newName = options.getString('name');
    const newDescription = options.getString('description');

    if (!newName && !newDescription) {
        return client.utils.Embed(interaction, Colors.Red, 'Invalid Input', 'You must provide a new name or a new description to edit.');
    }

    const sticker = guild.stickers.cache.get(stickerId);
    if (!sticker) {
        return client.utils.Embed(interaction, Colors.Red, 'Not Found', 'That sticker could not be found in this server.');
    }
    
    // Validate name length if provided
    if (newName && (newName.length < 2 || newName.length > 30)) {
        return client.utils.Embed(interaction, Colors.Red, 'Invalid Name', 'Sticker names must be between 2 and 30 characters.');
    }

    try {
        const oldName = sticker.name;
        const updatedSticker = await sticker.edit({
            name: newName || sticker.name,
            description: newDescription || sticker.description,
        });
        
        await interaction.editReply({
            content: `Successfully edited sticker! \`${oldName}\` -> \`${updatedSticker.name}\``,
            stickers: [updatedSticker]
        });

    } catch (error) {
        console.error(`Failed to edit sticker ${sticker.name}:`, error);
        await client.utils.Embed(interaction, Colors.Red, 'Error', `An error occurred while editing the sticker.`);
    }
};