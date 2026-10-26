import { Events } from 'discord.js';
import { Giveaway } from '../models/giveaway.js';
import { endGiveaway, startScheduledGiveaway, recoverInterrupted, deleteOldGiveaways } from '../utils/lifecycle.js';
import { migrateLegacyGiveaways } from '../utils/legacy.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Giveaways: Start and End on Time';

/** How often due giveaways are checked. A giveaway ends at most this long after its end time. */
export const TICK_MS = 15_000;
const CLEANUP_MS = 60 * 60 * 1000;

/**
 * Starts scheduled giveaways and ends finished ones, for this shard's servers.
 * @param {import('discord.js').Client} client
 * @param {Date} [now]
 */
export async function tick(client, now = new Date()) {
    const guildIds = [...client.guilds.cache.keys()];
    if (guildIds.length === 0) return;

    const due = await Giveaway.find(
        {
            guildId: { $in: guildIds },
            $or: [
                { status: 'scheduled', startsAt: { $lte: now } },
                { status: 'running', endsAt: { $lte: now } },
            ],
        },
        { guildId: 1, status: 1 }
    )
        .limit(100)
        .lean();

    for (const giveaway of due) {
        const guild = client.guilds.cache.get(giveaway.guildId);
        if (!guild) continue; // Ovx left the server since the query
        try {
            if (giveaway.status === 'scheduled') await startScheduledGiveaway(guild, giveaway);
            else await endGiveaway(guild, String(giveaway._id), now);
        } catch (error) {
            LogData(
                'Giveaways',
                `Guild: ${guild.name} | ${giveaway.status} giveaway failed: ${error.message}`,
                'error'
            );
        }
    }
}

/**
 * @param {import('discord.js').Client} client
 */
export async function execute(client) {
    const guildIds = () => [...client.guilds.cache.keys()];
    // Before anything else reads them: giveaways from the old Ovx bot, in its own format
    await migrateLegacyGiveaways(client).catch((error) =>
        LogData('Giveaways', `Could not convert old giveaways: ${error.message}`, 'warning')
    );
    await recoverInterrupted(guildIds()).catch((error) =>
        LogData('Giveaways', `Could not recover interrupted giveaways: ${error.message}`, 'warning')
    );

    let running = false;
    const run = async () => {
        if (running) return; // The last check is still going
        running = true;
        try {
            await tick(client);
        } catch (error) {
            LogData('Giveaways', `Check failed: ${error.message}`, 'warning');
        } finally {
            running = false;
        }
    };
    setTimeout(run, 5_000).unref();
    setInterval(run, TICK_MS).unref();

    setInterval(() => {
        deleteOldGiveaways(guildIds()).catch((error) =>
            LogData('Giveaways', `Cleanup failed: ${error.message}`, 'warning')
        );
    }, CLEANUP_MS).unref();
}
