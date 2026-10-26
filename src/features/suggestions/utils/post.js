import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { CLOSED_STATUSES } from '../models/suggestion.js';
import { Translate } from '../../../shared/utils/i18n.js';

/** Vote buttons: `sg:up:<id>` and `sg:down:<id>` */
export const SUGGESTION_PREFIX = 'sg:';

const STATUS_COLOURS = {
    pending: '#5865f2',
    considering: '#f5b301',
    approved: '#23a55a',
    denied: '#da373c',
    implemented: '#b69cff',
};
const STATUS_EMOJIS = { pending: '🗳️', considering: '🤔', approved: '✅', denied: '❌', implemented: '🚀' };

/**
 * @typedef {import('../models/suggestion.js').SuggestionType} SuggestionType
 */

/**
 * "72% in favour" from the votes, or null with none yet.
 * @param {number} up
 * @param {number} down
 */
export function approval(up, down) {
    const total = up + down;
    return total === 0 ? null : Math.round((up / total) * 100);
}

/**
 * The suggestion's message, for its current status and votes.
 * @param {import('discord.js').Guild} guild
 * @param {SuggestionType} suggestion
 * @returns {import('discord.js').BaseMessageOptions}
 */
export function suggestionMessage(guild, suggestion) {
    const locale = guild.preferredLocale;
    const t = (key, vars) => Translate(`suggestions.post.${key}`, locale, vars);
    const up = suggestion.upvoters.length;
    const down = suggestion.downvoters.length;
    const percent = approval(up, down);
    const author = guild.members.cache.get(suggestion.authorId);

    const embed = new EmbedBuilder()
        .setColor(/** @type {`#${string}`} */ (STATUS_COLOURS[suggestion.status]))
        .setAuthor({
            name: author?.displayName ?? t('unknown_author'),
            iconURL: author?.displayAvatarURL({ size: 64 }),
        })
        .setTitle(t('title', { number: suggestion.number }))
        .setDescription(suggestion.content)
        .addFields({
            name: t('status'),
            value: `${STATUS_EMOJIS[suggestion.status]} ${t(`status_${suggestion.status}`)}${
                suggestion.decidedBy ? ` ${t('by', { user: `<@${suggestion.decidedBy}>` })}` : ''
            }`,
            inline: true,
        })
        .addFields({
            name: t('votes'),
            value: percent === null ? t('no_votes') : t('vote_summary', { up, down, percent }),
            inline: true,
        })
        .setFooter({ text: t('footer', { id: suggestion.authorId }) })
        .setTimestamp(suggestion.createdAt);
    if (suggestion.reason) embed.addFields({ name: t('reason'), value: suggestion.reason.slice(0, 1024) });
    if (suggestion.imageUrl) embed.setImage(suggestion.imageUrl);

    const closed = CLOSED_STATUSES.includes(suggestion.status);
    const id = String(suggestion._id);
    const row = /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
        new ButtonBuilder()
            .setCustomId(`${SUGGESTION_PREFIX}up:${id}`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('👍')
            .setLabel(String(up))
            .setDisabled(closed),
        new ButtonBuilder()
            .setCustomId(`${SUGGESTION_PREFIX}down:${id}`)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('👎')
            .setLabel(String(down))
            .setDisabled(closed)
    );
    return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}
