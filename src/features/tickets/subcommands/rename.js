import { renameAction } from '../utils/ticketActions.js';

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export function execute(interaction) {
    return renameAction(interaction, interaction.options.getString('name', true));
}
