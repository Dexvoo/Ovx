import { MessageFlags } from 'discord.js';

/**
 * A private error reply (also for buttons).
 * @param {import('discord.js').RepliableInteraction<'cached'>} interaction
 * @param {string} message
 */
export function replyError(interaction, message) {
    const { client, locale } = interaction;
    return client.utils.Embed(interaction, 'Red', client.utils.Translate('errors.title', locale), message, {
        flags: MessageFlags.Ephemeral,
    });
}
