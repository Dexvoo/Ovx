import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { hasEmbed } from './validation.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';

/**
 * The Discord message for a saved custom message.
 * @param {import('discord.js').Guild} guild
 * @param {any} saved - A saved custom message (lean document, see CustomMessageType)
 * @returns {Promise<import('discord.js').MessageCreateOptions>}
 */
export async function customMessage(guild, saved) {
    const source = saved.embed;
    const embeds = [];
    if (hasEmbed(source)) {
        const embed = new EmbedBuilder().setColor(
            /** @type {`#${string}`} */ (source.colour ?? (await brandColour(guild.id)))
        );
        if (source.title) embed.setTitle(source.title);
        if (source.title && source.url) embed.setURL(source.url);
        if (source.description) embed.setDescription(source.description);
        if (source.author?.name) {
            embed.setAuthor({
                name: source.author.name,
                iconURL: source.author.iconUrl ?? undefined,
                url: source.author.url ?? undefined,
            });
        }
        if (source.fields?.length)
            embed.addFields(source.fields.map(({ name, value, inline }) => ({ name, value, inline })));
        if (source.thumbnailUrl) embed.setThumbnail(source.thumbnailUrl);
        if (source.imageUrl) embed.setImage(source.imageUrl);
        if (source.footer?.text)
            embed.setFooter({ text: source.footer.text, iconURL: source.footer.iconUrl ?? undefined });
        if (source.timestamp) embed.setTimestamp();
        embeds.push(embed);
    }

    const components = saved.buttons?.length
        ? [
              /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
                  saved.buttons.map((item) => {
                      const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(item.url);
                      if (item.label) button.setLabel(item.label);
                      if (item.emoji) button.setEmoji(item.emoji);
                      return button;
                  })
              ),
          ]
        : [];

    return {
        content: saved.content || undefined,
        embeds,
        components,
        // Off by default: mentions show, but only ping when the server chose to allow it
        allowedMentions: saved.allowPings ? { parse: ['users', 'roles', 'everyone'] } : { parse: [] },
    };
}
