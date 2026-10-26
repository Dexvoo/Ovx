import { Events } from 'discord.js';
import { postDue } from '../utils/messages.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Auto Messages: Post on Schedule';

const TICK_MS = 60_000;

/**
 * Posts this shard's due auto messages once a minute.
 * @param {import('discord.js').Client} client
 */
export function execute(client) {
    let running = false;
    setInterval(async () => {
        if (running) return;
        running = true;
        try {
            await postDue(client);
        } catch (error) {
            LogData('Auto Messages', `Check failed: ${error.message}`, 'warning');
        } finally {
            running = false;
        }
    }, TICK_MS).unref();
}
