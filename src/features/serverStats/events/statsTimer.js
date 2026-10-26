import { Events } from 'discord.js';
import { updateAll, UPDATE_MS } from '../utils/counters.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Server Stats: Update Counters';

/**
 * Updates this shard's counter channels every 10 minutes (Discord's limit for renaming a channel).
 * @param {import('discord.js').Client} client
 */
export function execute(client) {
    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try {
            await updateAll(client);
        } catch (error) {
            LogData('Server Stats', `Update failed: ${error.message}`, 'warning');
        } finally {
            running = false;
        }
    };
    // The first update waits a little, so it doesn't add to startup work
    setTimeout(run, 60_000).unref();
    setInterval(run, UPDATE_MS).unref();
}
