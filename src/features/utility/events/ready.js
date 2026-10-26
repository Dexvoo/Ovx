import { Events } from 'discord.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Console Log Client Ready';

/**
 * @typedef {import('../../../core/extendedClient.js').default} Client
 * @param { Client } client
 */

export async function execute(client) {
    client.utils.LogData('Client Ready', `Logged in as ${client.user.tag}!`, 'info');
}
