import { LogData } from '../../../shared/utils/logger.js';

/** How often the server count is sent. Top.gg only needs it now and then; it shows it on the bot's page. */
export const STATS_INTERVAL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Sends the server and shard counts to Top.gg once.
 * @param {{
 *   manager: Pick<import('discord.js').ShardingManager, 'fetchClientValues' | 'totalShards'>,
 *   token: string,
 *   applicationId: string,
 *   fetchImpl?: typeof fetch,
 * }} options
 * @returns {Promise<number | null>} The server count sent, or null if it wasn't
 */
export async function postTopggStats({ manager, token, applicationId, fetchImpl = fetch }) {
    let serverCount;
    try {
        const counts = /** @type {number[]} */ (await manager.fetchClientValues('guilds.cache.size'));
        serverCount = counts.reduce((total, count) => total + count, 0);
    } catch (error) {
        // Shards still starting or restarting: try again next time
        LogData('Top.gg', `Could not count servers: ${error.message}`, 'warning');
        return null;
    }

    try {
        const response = await fetchImpl(`https://top.gg/api/bots/${applicationId}/stats`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ server_count: serverCount, shard_count: Number(manager.totalShards) || 1 }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
            const hint = response.status === 401 || response.status === 403 ? ' (check TOPGG_TOKEN)' : '';
            LogData('Top.gg', `Posting stats failed: HTTP ${response.status}${hint}`, 'warning');
            return null;
        }
    } catch (error) {
        LogData('Top.gg', `Posting stats failed: ${error.message}`, 'warning');
        return null;
    }

    LogData('Top.gg', `Posted stats: ${serverCount} servers`, 'info');
    return serverCount;
}

/**
 * Posts stats now and then every STATS_INTERVAL_MS.
 * @param {Parameters<typeof postTopggStats>[0]} options
 * @returns {() => void} Stops posting
 */
export function startTopggStats(options) {
    postTopggStats(options);
    const timer = setInterval(() => postTopggStats(options), STATS_INTERVAL_MS);
    timer.unref();
    return () => clearInterval(timer);
}
