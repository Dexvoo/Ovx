import { Events } from 'discord.js';
import { cleanUpChannels } from '../utils/channels.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Temp Voice: Clean Up After a Restart';

/**
 * @param {import('discord.js').Client} client
 */
export async function execute(client) {
    await cleanUpChannels(client).catch((error) =>
        LogData('Temp Voice', `Cleanup failed: ${error.message}`, 'warning')
    );
}
