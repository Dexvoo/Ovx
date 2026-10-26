import { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { listLanguages } from '../utils/googleTranslate.js';
import { findLanguage, localeToLanguage, matchLanguages } from '../utils/languages.js';
import { replyWithTranslation, replyError, t, MAX_TEXT_LENGTH } from '../utils/reply.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('translate');
commandData.setDescription('Translate text into another language.');
// Also installable to a user's own account, so it works in DMs and group chats
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]);
commandData.setContexts([
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
]);
commandData.addStringOption((option) =>
    option.setName('text').setDescription('What to translate.').setRequired(true).setMaxLength(MAX_TEXT_LENGTH)
);
commandData.addStringOption((option) =>
    option
        .setName('to')
        .setDescription('The language to translate into. Defaults to your Discord language.')
        .setAutocomplete(true)
);
commandData.addStringOption((option) =>
    option
        .setName('from')
        .setDescription("The text's language. Detected automatically if left out.")
        .setAutocomplete(true)
);
commandData.addBooleanOption((option) => option.setName('private').setDescription('Only you can see the translation.'));

export const meta = {
    cooldown: 5,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
    // Kept out of the developer command log: it's often someone's private messages
    privateOptions: ['text'],
};

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
    const { options } = interaction;
    const languages = await listLanguages();

    const toInput = options.getString('to');
    const to = toInput ? findLanguage(toInput, languages)?.code : localeToLanguage(interaction.locale);
    if (!to) return replyError(interaction, t(interaction, 'unknown_language', { language: toInput }));

    const fromInput = options.getString('from');
    const from = fromInput ? findLanguage(fromInput, languages)?.code : null;
    if (fromInput && !from) return replyError(interaction, t(interaction, 'unknown_language', { language: fromInput }));

    return replyWithTranslation(interaction, {
        text: options.getString('text', true),
        to,
        from,
        ephemeral: options.getBoolean('private') ?? false,
    });
}

/**
 * @param {import('discord.js').AutocompleteInteraction} interaction
 */
export async function autocomplete(interaction) {
    const languages = await listLanguages();
    await interaction.respond(matchLanguages(interaction.options.getFocused(), languages));
}
