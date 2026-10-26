import { Events } from 'discord.js';
import { reconcileGuilds, sweepDepartedGuilds, SWEEP_INTERVAL_MS } from '../utils/retention.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Data Retention: Delete Data of Removed Servers';

/**
 * @param {import('discord.js').Client} client
 */
export async function execute(client) {
    const sweep = () =>
        sweepDepartedGuilds(client).catch((error) => {
            LogData('Data Retention', `Sweep failed: ${error.message}`, 'warning');
        });

    try {
        const gone = await reconcileGuilds(client);
        if (gone > 0) LogData('Data Retention', `${gone} server(s) removed Ovx while it was offline`, 'info');
    } catch (error) {
        LogData('Data Retention', `Startup check failed: ${error.message}`, 'warning');
    }

    // The first sweep waits a little, so it doesn't add to startup work
    setTimeout(sweep, 60_000).unref();
    setInterval(sweep, SWEEP_INTERVAL_MS).unref();
}
