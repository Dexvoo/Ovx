import { lockAction } from '../utils/ticketActions.js';

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export function execute(interaction) {
    return lockAction(interaction, true);
}
