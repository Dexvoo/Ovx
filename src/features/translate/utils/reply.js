import { EmbedBuilder, MessageFlags } from 'discord.js';
import { translateText, listLanguages, TranslateError } from './googleTranslate.js';
import { languageName, isSameLanguage } from './languages.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { LogData } from '../../../shared/utils/logger.js';

/** Most characters translated at once: a Discord message (without Nitro). Keeps quota use predictable. */
export const MAX_TEXT_LENGTH = 2000;

/**
 * @param {import('discord.js').RepliableInteraction} interaction
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 */
export const t = (interaction, key, vars) =>
    interaction.client.utils.Translate(`commands.translate.${key}`, interaction.locale, vars);

/**
 * An error only the user sees. Works before and after deferring.
 * @param {import('discord.js').RepliableInteraction} interaction
 * @param {string} message
 */
export async function replyError(interaction, message) {
    const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle(interaction.client.utils.Translate('errors.title', interaction.locale))
        .setDescription(message);

    if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    // A public "thinking…" message would show the error to everyone, so it's swapped for a private one
    await interaction.deleteReply().catch(() => {});
    return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

/**
 * Translates text and replies with the original and the translation.
 * Works anywhere, including DMs and servers Ovx isn't in (when the user installed it).
 * @param {import('discord.js').RepliableInteraction} interaction
 * @param {object} options
 * @param {string} options.text
 * @param {string} options.to - Language code
 * @param {string | null} [options.from] - Language code, or null to detect it
 * @param {boolean} [options.ephemeral]
 */
export async function replyWithTranslation(interaction, { text, to, from = null, ephemeral = false }) {
    const truncated = text.length > MAX_TEXT_LENGTH;
    const input = truncated ? text.slice(0, MAX_TEXT_LENGTH) : text;

    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});

    let translation;
    try {
        translation = await translateText(input, to, from);
    } catch (error) {
        const reason = error instanceof TranslateError ? error.reason : 'failed';
        if (reason === 'failed' || reason === 'limit') {
            LogData('Translate', error.message, reason === 'limit' ? 'warning' : 'error');
        }
        return replyError(interaction, t(interaction, reason));
    }

    const languages = await listLanguages();
    const fromName = languageName(translation.from, languages);
    const toName = languageName(to, languages);

    if (isSameLanguage(translation.from, to)) {
        return replyError(interaction, t(interaction, 'same_language', { language: toName }));
    }

    const { utils } = interaction.client;
    // Only servers Ovx is in have a colour (and settings) of their own
    const colour = await brandColour(interaction.inCachedGuild() ? interaction.guildId : null);
    const embed = new EmbedBuilder()
        .setColor(colour)
        .setTitle(t(interaction, 'title', { from: fromName, to: toName }))
        .setDescription(utils.Truncate(translation.text, 4000))
        .addFields({ name: t(interaction, 'original'), value: utils.Truncate(input, 1024) })
        .setFooter({ text: t(interaction, 'footer', { user: interaction.user.username }) });

    if (truncated) {
        embed.addFields({ name: '​', value: t(interaction, 'truncated', { count: MAX_TEXT_LENGTH }) });
    }

    // Translations can contain mentions; they're shown, never pinged
    return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
}
