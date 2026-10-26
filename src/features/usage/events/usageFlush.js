import { Events } from 'discord.js';
import { flushUsage } from '../utils/usage.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Saves the usage counted in memory once a minute';

const FLUSH_MS = 60_000;

export async function execute() {
    setInterval(() => {
        flushUsage().catch((error) => LogData('Usage', `Could not save usage: ${error.message}`, 'warning'));
    }, FLUSH_MS).unref();
}
