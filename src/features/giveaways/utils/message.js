import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { Translate } from '../../../shared/utils/i18n.js';
import { votesEnabled, voteUrl } from '../../votes/utils/votes.js';

/** Button custom IDs: `giveaway:enter:<giveawayId>` and `giveaway:leave:<giveawayId>` */
export const GIVEAWAY_BUTTONS = Object.freeze({ enter: 'giveaway:enter', leave: 'giveaway:leave' });

const ENDED_COLOUR = '#99AAB5';

/**
 * @param {import('../models/giveaway.js').GiveawayType} giveaway
 * @param {string} locale
 */
function requirementLines(giveaway, locale) {
    const t = (key, vars) => Translate(`giveaways.message.${key}`, locale, vars);
    const lines = [];
    const { roleIds, minLevel } = giveaway.requirements ?? { roleIds: [], minLevel: 0 };
    if (roleIds.length > 0) lines.push(t('requires_role', { roles: roleIds.map((id) => `<@&${id}>`).join(', ') }));
    if (minLevel > 0) lines.push(t('requires_level', { level: minLevel }));
    if (giveaway.voteBonus > 0 && votesEnabled()) lines.push(t('vote_bonus', { count: giveaway.voteBonus }));
    return lines;
}

/** @param {Date} date */
const unix = (date) => Math.floor(new Date(date).getTime() / 1000);

/**
 * The giveaway's message, for its current state.
 * @param {import('discord.js').Guild} guild
 * @param {import('../models/giveaway.js').GiveawayType} giveaway
 * @returns {Promise<import('discord.js').BaseMessageOptions>}
 */
export async function giveawayMessage(guild, giveaway) {
    const locale = guild.preferredLocale;
    const t = (key, vars) => Translate(`giveaways.message.${key}`, locale, vars);
    const id = String(giveaway._id);
    const open = giveaway.status === 'running';

    const lines = giveaway.description ? [giveaway.description, ''] : [];
    if (open) {
        lines.push(t('ends', { relative: `<t:${unix(giveaway.endsAt)}:R>`, date: `<t:${unix(giveaway.endsAt)}:f>` }));
        lines.push(t('winner_count', { count: giveaway.winnerCount }));
    } else if (giveaway.status === 'cancelled') {
        lines.push(t('cancelled'));
    } else {
        lines.push(t('ended', { relative: `<t:${unix(giveaway.endedAt ?? giveaway.endsAt)}:R>` }));
        lines.push(
            giveaway.winners.length > 0
                ? t('winners', { winners: giveaway.winners.map((userId) => `<@${userId}>`).join(', ') })
                : t('no_winners')
        );
    }
    lines.push(t('host', { host: `<@${giveaway.hostId}>` }));
    if (open) {
        const requirements = requirementLines(giveaway, locale);
        if (requirements.length > 0) lines.push('', ...requirements);
    }

    const embed = new EmbedBuilder()
        .setColor(open ? await brandColour(guild.id) : ENDED_COLOUR)
        .setTitle(`🎉 ${giveaway.prize}`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: t('entrants', { count: giveaway.entrantCount }) })
        .setTimestamp(open ? giveaway.endsAt : (giveaway.endedAt ?? giveaway.endsAt));

    const enter = new ButtonBuilder()
        .setCustomId(`${GIVEAWAY_BUTTONS.enter}:${id}`)
        .setStyle(open ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('🎉')
        .setLabel(open ? t('enter') : giveaway.status === 'cancelled' ? t('cancelled_button') : t('ended_button'))
        .setDisabled(!open);
    const row = /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(enter);
    if (open && giveaway.voteBonus > 0 && votesEnabled()) {
        row.addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(voteUrl())
                .setLabel(t('vote_button', { count: giveaway.voteBonus }))
        );
    }

    // Mentions in the message are shown, never pinged (the winner announcement pings separately)
    return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}
