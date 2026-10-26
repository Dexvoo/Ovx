import { Events } from 'discord.js';
import { checkMessage } from '../utils/blocker.js';

export const name = Events.MessageCreate;
export const once = false;
export const description = 'Invite Blocker: New Messages';

/**
 * @param {import('discord.js').Message} message
 */
export async function execute(message) {
    await checkMessage(message);
}
