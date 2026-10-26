import { addAction } from '../utils/ticketActions.js';

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export function execute(interaction) {
    return addAction(interaction, interaction.options.getUser('member', true));
}
