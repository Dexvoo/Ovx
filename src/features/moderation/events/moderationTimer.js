import { Events } from 'discord.js';
import { endTempBans, endLocks, postLockNotice } from '../utils/timers.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Ends temporary bans and channel locks when their time is up';

const CHECK_MS = 60_000;

/**
 * @param {import('../../../core/extendedClient.js').default} client
 */
export async function execute(client) {
    let running = false;
    const check = async () => {
        if (running) return;
        running = true;
        try {
            await endTempBans(client);
            await endLocks(client, {
                notice: (channel) =>
                    postLockNotice(
                        channel,
                        client.utils.Translate('commands.moderation.unlock_notice', channel.guild.preferredLocale)
                    ),
            });
        } catch (error) {
            LogData('Moderation', `Timed actions check failed: ${error.message}`, 'error');
        } finally {
            running = false;
        }
    };
    setInterval(check, CHECK_MS).unref();
    check();
}
