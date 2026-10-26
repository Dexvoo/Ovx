import { LogData } from '../shared/utils/logger.js';
import User_Levels_Cache from '../features/levels/cache/userLevels.cache.js';
import { Database_Disconnect, Database_IsConnected } from './database.js';

// If a step hangs (e.g. a stuck database connection), exit anyway after this long
const FORCE_EXIT_MS = 10_000;

let shuttingDown = false;

/**
 * Shuts this shard down cleanly: stops receiving Discord events, saves pending XP,
 * then closes the database connection. Safe to call more than once; only the first call runs.
 * @param {string} signal - What triggered the shutdown, for logging
 * @param {import('../core/extendedClient.js').default} [client]
 * @param {number} [exitCode=0]
 */
export async function Shutdown(signal, client, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;

    LogData('Shutdown Initiated', `Received ${signal}. Closing connections cleanly...`, 'warning');

    setTimeout(() => {
        LogData('Shutdown', `Timed out after ${FORCE_EXIT_MS / 1000}s, forcing exit.`, 'error');
        process.exit(1);
    }, FORCE_EXIT_MS).unref();

    try {
        // Disconnect from Discord first so no new events add XP after the final flush
        await client?.destroy?.();

        // Skip when the database is down, otherwise mongoose buffers the write until it times out
        if (Database_IsConnected()) {
            await User_Levels_Cache.flush();
        } else {
            LogData('Shutdown', 'Database not connected, unsaved XP could not be flushed.', 'warning');
        }

        await Database_Disconnect();

        process.exit(exitCode);
    } catch (error) {
        LogData('Shutdown', `Error during shutdown: ${error.stack ?? error.message}`, 'error');
        process.exit(1);
    }
}
