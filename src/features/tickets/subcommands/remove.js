import { removeAction } from '../utils/ticketActions.js';

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export function execute(interaction) {
    return removeAction(interaction, interaction.options.getUser('member', true));
}
