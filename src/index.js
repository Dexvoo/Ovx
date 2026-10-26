import { ShardingManager } from 'discord.js';
import { fileURLToPath } from 'url';
import { LogData, Log } from './shared/utils/logger.js';
import { ENV } from './bootstrap/environment.js';

Log('Mushroom Discord Bot | Created by: @Dexvo');
if (ENV.DEVELOPER_MODE) LogData('Developer Mode Enabled', 'The bot is running in Developer Mode.', 'warning');

// Shards get FORCE_EXIT_MS (10s) to shut down themselves; give them a little longer here
const SHARD_SHUTDOWN_TIMEOUT_MS = 15_000;

let shuttingDown = false;

const ShardManager = new ShardingManager(fileURLToPath(new URL('./bootstrap/client.js', import.meta.url)), {
    token: ENV.TOKEN,
    totalShards: 'auto',
});

ShardManager.on('shardCreate', (shard) => {
    LogData('Shard Spawned', `Shard ${shard.id} has been spawned.`, 'info');
    shard.on('ready', () => {
        LogData('Shard Ready', `Shard ${shard.id} is ready.`, 'success');
    });
    shard.on('disconnect', () => {
        LogData('Shard Disconnected', `Shard ${shard.id} has disconnected.`, 'warning');
    });
    shard.on('reconnecting', () => {
        LogData('Shard Reconnecting', `Shard ${shard.id} is reconnecting.`, 'info');
    });
    shard.on('death', () => {
        if (shuttingDown) LogData('Shard Stopped', `Shard ${shard.id} has shut down.`, 'info');
        else LogData('Shard Died', `Shard ${shard.id} has died.`, 'error');
    });
});

/** @type {import('node:http').Server | null} */
let dashboardServer = null;

ShardManager.spawn()
    .then(async () => {
        // The server count on Ovx's Top.gg page. Not from developer mode, which runs a different bot.
        if (ENV.TOPGG_TOKEN && !ENV.DEVELOPER_MODE) {
            const { startTopggStats } = await import('./features/votes/utils/topggStats.js');
            startTopggStats({ manager: ShardManager, token: ENV.TOPGG_TOKEN, applicationId: ENV.APPLICATION_ID });
        }

        if (!ENV.DASHBOARD) return;
        // Loaded only when enabled, so the bot doesn't pull in the web server otherwise
        const { startDashboard } = await import('./dashboard/server.js');
        dashboardServer = await startDashboard({ manager: ShardManager, env: ENV });
    })
    .catch((error) => {
        LogData('Startup Error', `${error.stack ?? error.message}`, 'error');
    });

/**
 * Asks every shard to shut down cleanly (saving XP, closing the database) and waits for them.
 * Shard.kill() would terminate them immediately, so the request goes over IPC instead.
 * @param {string} signal
 */
async function shutdownShards(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    LogData('Shutdown Initiated', `Received ${signal}. Stopping ${ShardManager.shards.size} shard(s)...`, 'warning');

    // Stop the manager from respawning shards as they exit
    ShardManager.respawn = false;

    const running = [...ShardManager.shards.values()].filter((shard) => shard.process);
    const stopped = running.map(
        (shard) =>
            new Promise((resolve) => {
                shard.once('death', resolve);
                shard.send({ type: 'shutdown' }).catch(resolve); // Already gone
            })
    );

    const timedOut = await Promise.race([
        Promise.all(stopped).then(() => false),
        new Promise((resolve) => setTimeout(() => resolve(true), SHARD_SHUTDOWN_TIMEOUT_MS)),
    ]);

    if (timedOut) {
        LogData('Shutdown', 'Some shards did not stop in time, killing them.', 'error');
        for (const shard of running) shard.kill();
    }

    LogData('Shutdown', 'All shards stopped.', 'success');

    if (dashboardServer) {
        dashboardServer.closeAllConnections();
        await new Promise((resolve) => dashboardServer.close(resolve));
        const { default: mongoose } = await import('mongoose');
        await mongoose.disconnect();
    }

    process.exit(timedOut ? 1 : 0);
}

process.on('SIGINT', () => shutdownShards('SIGINT')); // CTRL+C in terminal
process.on('SIGTERM', () => shutdownShards('SIGTERM')); // Docker/PM2 stop commands
