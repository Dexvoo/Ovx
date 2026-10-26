import { closeAction } from '../utils/ticketActions.js';

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export function execute(interaction) {
    return closeAction(interaction, interaction.options.getString('reason')?.trim() || null);
}
