import { Events } from 'discord.js';
import { removeUnverified } from '../utils/verify.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Verification: Remove Members Who Never Verify';

const SWEEP_MS = 60 * 60 * 1000;

/**
 * Once an hour, for this shard's servers that remove unverified members.
 * @param {import('discord.js').Client} client
 */
export function execute(client) {
    setInterval(() => {
        removeUnverified(client)
            .then(
                (removed) => removed > 0 && LogData('Verification', `Removed ${removed} unverified member(s)`, 'info')
            )
            .catch((error) => LogData('Verification', `Sweep failed: ${error.message}`, 'warning'));
    }, SWEEP_MS).unref();
}
