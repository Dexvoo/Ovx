import {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    ApplicationIntegrationType,
    InteractionContextType,
} from 'discord.js';
import { localeToLanguage } from '../utils/languages.js';
import { replyWithTranslation, replyError, t } from '../utils/reply.js';

// Right-click a message → Apps → Translate
export const commandData = new ContextMenuCommandBuilder();
commandData.setName('Translate');
commandData.setType(ApplicationCommandType.Message);
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]);
commandData.setContexts([
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
]);

export const meta = {
    cooldown: 3,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * Translates the message into the user's own Discord language. Only they see it.
 * @param {import('discord.js').MessageContextMenuCommandInteraction} interaction
 */
export async function execute(interaction) {
    const text = messageText(interaction.targetMessage);
    if (!text) return replyError(interaction, t(interaction, 'no_text'));

    return replyWithTranslation(interaction, {
        text,
        to: localeToLanguage(interaction.locale),
        ephemeral: true,
    });
}

/**
 * The text of a message, or of its first embed (e.g. a bot's message) when it has none.
 * @param {import('discord.js').Message} message
 * @returns {string}
 */
export function messageText(message) {
    if (message.content?.trim()) return message.content;
    const embed = message.embeds[0];
    return [embed?.title, embed?.description].filter(Boolean).join('\n').trim();
}
