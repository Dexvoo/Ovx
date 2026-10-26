import { Events } from 'discord.js';
import { handleDeletedMessage } from '../utils/starboard.js';

export const name = Events.MessageDelete;
export const once = false;
export const description = 'Starboard: Deleted Messages';

/**
 * @param {import('discord.js').Message | import('discord.js').PartialMessage} message
 */
export async function execute(message) {
    await handleDeletedMessage(message);
}
