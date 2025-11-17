const { Colors, StickerFormatType, GuildPremiumTier } = require('discord.js');

const STICKER_SLOTS = {
    [GuildPremiumTier.None]: 5,
    [GuildPremiumTier.Tier1]: 15,
    [GuildPremiumTier.Tier2]: 30,
    [GuildPremiumTier.Tier3]: 60,
};

const MESSAGE_LINK_REGEX = /https?:\/\/(?:ptb\.|canary\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function StickerTake(interaction) {
    const { client, guild, options } = interaction;

    const name = options.getString('name');
    const messageLink = options.getString('message_link');
    const description = options.getString('description') || '';

    // Check sticker slot availability
    const maxStickers = STICKER_SLOTS[guild.premiumTier];
    if (guild.stickers.cache.size >= maxStickers) {
        return client.utils.Embed(interaction, Colors.Red, 'Upload Failed', `This server has reached its sticker limit of **${maxStickers}**.`);
    }

    // Validate message link
    const match = messageLink.match(MESSAGE_LINK_REGEX);
    if (!match) {
        return client.utils.Embed(interaction, Colors.Red, 'Invalid Link', 'The provided message link is not valid.');
    }
    const [guildId, channelId, messageId] = match;

    // Validate name length
    if (name.length < 2 || name.length > 30) {
        return client.utils.Embed(interaction, Colors.Red, 'Invalid Name', 'Sticker names must be between 2 and 30 characters.');
    }

    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            return client.utils.Embed(interaction, Colors.Red, 'Fetch Error', 'Could not find the channel from the link. Stickers must be ');
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message || message.stickers.size === 0) {
            return client.utils.Embed(interaction, Colors.Red, 'No Sticker Found', 'The message at the provided link does not contain a sticker.');
        }

        const stickerToTake = message.stickers.first();

        // LOTTIE format is for partners/verified servers only, so we can't create them.
        if (stickerToTake.format === StickerFormatType.Lottie) {
            return client.utils.Embed(interaction, Colors.Red, 'Unsupported Format', 'Lottie stickers cannot be added to this server.');
        }

        const newSticker = await guild.stickers.create({
            file: stickerToTake.url,
            name: name,
            tags: stickerToTake.tags,
            description: description,
        });

        await interaction.editReply({
            content: `Successfully added the sticker **${newSticker.name}**!`,
            stickers: [newSticker]
        });

    } catch (error) {
        console.error('Sticker Take Error:', error);
        let errorMessage = 'An unknown error occurred.';
        if (error.code === 50035) errorMessage = 'The sticker file might be too large (max 512KB) or the name/description is invalid.';
        else if (error.code === 10014) errorMessage = 'Could not find the message. It may have been deleted.';
        
        return client.utils.Embed(interaction, Colors.Red, 'Upload Failed', errorMessage);
    }
};