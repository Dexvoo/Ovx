import { Events, ActivityType, PresenceUpdateStatus } from 'discord.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Bot Status';

const ROTATE_MS = 5 * 60 * 1000;

/**
 * Servers across every shard; just this shard's while the others are still starting.
 * @param {import('discord.js').Client} client
 */
export async function totalServers(client) {
    if (!client.shard) return client.guilds.cache.size;
    try {
        const counts = /** @type {number[]} */ (await client.shard.fetchClientValues('guilds.cache.size'));
        return counts.reduce((total, count) => total + count, 0);
    } catch {
        return client.guilds.cache.size;
    }
}

/**
 * The statuses Ovx rotates through.
 * @param {import('discord.js').Client} client
 * @param {number} servers
 * @returns {string[]}
 */
export function statusLines(client, servers) {
    const shard = client.shard?.ids[0] ?? 0;
    return [`/help · ovxbot.com`, `Watching ${servers.toLocaleString('en-GB')} servers`, `Shard #${shard}`];
}

/**
 * @param {import('discord.js').Client} client
 */
export function execute(client) {
    let index = 0;
    const update = async () => {
        try {
            const lines = statusLines(client, await totalServers(client));
            client.user?.setPresence({
                status: PresenceUpdateStatus.Online,
                activities: [{ name: 'Custom Status', type: ActivityType.Custom, state: lines[index % lines.length] }],
            });
            index++;
        } catch (error) {
            LogData('Status', `Could not set the status: ${error.message}`, 'warning');
        }
    };
    update();
    setInterval(update, ROTATE_MS).unref();
}
