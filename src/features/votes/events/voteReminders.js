import { Events } from 'discord.js';
import { sendDueReminders } from '../utils/reminders.js';
import { votesEnabled } from '../utils/votes.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Vote Reminders';

const CHECK_MS = 60_000;

/**
 * Sends vote reminders once a minute. Reminders aren't tied to a server, so only the first shard sends them.
 * @param {import('discord.js').Client} client
 */
export function execute(client) {
    if (!votesEnabled()) return;
    if (client.shard && !client.shard.ids.includes(0)) return;

    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try {
            await sendDueReminders(client);
        } catch (error) {
            LogData('Vote Reminders', `Check failed: ${error.message}`, 'warning');
        } finally {
            running = false;
        }
    };
    setInterval(run, CHECK_MS).unref();
}
