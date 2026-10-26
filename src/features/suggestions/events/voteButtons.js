import { Events, MessageFlags } from 'discord.js';
import { SUGGESTION_PREFIX } from '../utils/post.js';
import { vote, refreshPost } from '../utils/actions.js';
import { Suggestion } from '../models/suggestion.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Suggestion Votes';

/** Suggestion ID → pending update of its message, so a burst of votes is one edit */
const pending = new Map();
const REFRESH_DELAY_MS = 3000;

/**
 * @param {import('discord.js').Guild} guild
 * @param {string} suggestionId
 */
function scheduleRefresh(guild, suggestionId) {
    if (pending.has(suggestionId)) return;
    const timer = setTimeout(async () => {
        pending.delete(suggestionId);
        const suggestion = await Suggestion.findById(suggestionId)
            .lean()
            .catch(() => null);
        if (suggestion) await refreshPost(guild, suggestion);
    }, REFRESH_DELAY_MS);
    timer.unref?.();
    pending.set(suggestionId, timer);
}

/**
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
    if (!interaction.isButton() || !interaction.inCachedGuild() || !interaction.customId.startsWith(SUGGESTION_PREFIX))
        return;
    const [direction, suggestionId] = interaction.customId.slice(SUGGESTION_PREFIX.length).split(':');
    if (direction !== 'up' && direction !== 'down') return;
    const t = (key) => interaction.client.utils.Translate(`suggestions.vote.${key}`, interaction.locale);

    try {
        const result = await vote(interaction.guildId, suggestionId, interaction.user.id, direction);
        if (!result.ok) return interaction.reply({ content: t(result.error), flags: MessageFlags.Ephemeral });
        scheduleRefresh(interaction.guild, suggestionId);
        const key = result.vote === null ? 'removed' : result.vote === 'up' ? 'up' : 'down';
        return interaction.reply({ content: t(key), flags: MessageFlags.Ephemeral });
    } catch (error) {
        LogData('Suggestions', `Vote failed: ${error.message}`, 'error');
        await interaction.reply({ content: t('error'), flags: MessageFlags.Ephemeral }).catch(() => {});
    }
}
