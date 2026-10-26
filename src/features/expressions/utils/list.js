import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { freeEmojiSlots, freeStickerSlots } from './expressions.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { Translate } from '../../../shared/utils/i18n.js';

/** Page buttons: `expressions:list:<emoji|sticker>:<page>`. They hold the page, so they work after a restart. */
export const LIST_BUTTON_PREFIX = 'expressions:list';
const PER_PAGE = { emoji: 40, sticker: 20 };

/**
 * One page of a server's emojis or stickers, with buttons to the pages either side.
 * @param {import('discord.js').Guild} guild
 * @param {'emoji' | 'sticker'} kind
 * @param {number} requestedPage - Clamped to the pages there are
 * @param {string} locale
 * @returns {Promise<import('discord.js').InteractionReplyOptions & import('discord.js').InteractionUpdateOptions>}
 */
export async function listPage(guild, kind, requestedPage, locale) {
    const t = (key, vars) => Translate(`commands.expressions.list.${key}`, locale, vars);
    const lines =
        kind === 'emoji'
            ? [...guild.emojis.cache.values()]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((emoji) => `${emoji} \`:${emoji.name}:\``)
            : [...guild.stickers.cache.values()]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((sticker) => `[${sticker.name}](${sticker.url})${sticker.tags ? ` · :${sticker.tags}:` : ''}`);

    const pages = Math.max(1, Math.ceil(lines.length / PER_PAGE[kind]));
    const page = Math.min(Math.max(0, Math.trunc(requestedPage) || 0), pages - 1);
    const shown = lines.slice(page * PER_PAGE[kind], (page + 1) * PER_PAGE[kind]);

    let summary;
    if (kind === 'emoji') {
        const slots = freeEmojiSlots(guild);
        summary = t('emoji_slots', {
            static: slots.limit - slots.static,
            animated: slots.limit - slots.animated,
            limit: slots.limit,
        });
    } else {
        const slots = freeStickerSlots(guild);
        summary = t('sticker_slots', { used: slots.limit - slots.free, limit: slots.limit });
    }

    const embed = new EmbedBuilder()
        .setColor(await brandColour(guild.id))
        .setTitle(t(kind === 'emoji' ? 'emoji_title' : 'sticker_title', { guild: guild.name }))
        .setDescription([summary, '', ...(shown.length > 0 ? shown : [t(`${kind}_empty`)])].join('\n'))
        .setFooter({ text: t('page', { page: page + 1, pages }) });

    const button = (target, label) =>
        new ButtonBuilder()
            .setCustomId(`${LIST_BUTTON_PREFIX}:${kind}:${target}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel(label)
            .setDisabled(target < 0 || target >= pages);
    const components =
        pages > 1
            ? [
                  /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
                      button(page - 1, t('previous')),
                      button(page + 1, t('next'))
                  ),
              ]
            : [];

    return { embeds: [embed], components, allowedMentions: { parse: [] } };
}
