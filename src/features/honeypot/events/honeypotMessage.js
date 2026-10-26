import { Events } from 'discord.js';
import { checkMessage } from '../utils/honeypot.js';

export const name = Events.MessageCreate;
export const once = false;
export const description = 'Honeypot: Messages in the Honeypot Channel';

/**
 * @param {import('discord.js').Message} message
 */
export async function execute(message) {
    await checkMessage(message);
}
