import { Events } from 'discord.js';
import { onMessage } from '../utils/messages.js';

export const name = Events.MessageCreate;
export const once = false;
export const description = 'Sticky Messages';

/**
 * @param {import('discord.js').Message} message
 */
export async function execute(message) {
    await onMessage(message);
}
