import { Events } from 'discord.js';
import { runBackup, lastLocalBackup, backupDir } from '../utils/backup.js';
import { ENV } from '../../../bootstrap/environment.js';
import { reportError } from '../../../shared/utils/errorReport.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Daily Database Backups';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A backup older than this when Ovx starts means one was missed (it was offline at backup time). */
const OVERDUE_MS = 26 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 5 * 60 * 1000;

/**
 * Milliseconds until the next backup time.
 * @param {number} hour - UTC
 * @param {Date} [now]
 */
export function msUntilHour(hour, now = new Date()) {
    const next = new Date(now);
    next.setUTCHours(hour, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
}

/**
 * Backs the database up once a day, on the first shard only (the database is shared by every shard).
 * @param {import('discord.js').Client} client
 */
export async function execute(client) {
    if (!ENV.BACKUPS.ENABLED) return;
    if (client.shard && !client.shard.ids.includes(0)) return;

    const backup = () =>
        runBackup(client).catch((error) => reportError(client, { source: 'Database backup', error }));

    // Missed one while offline: catch up soon after starting, once the bot has settled
    const last = await lastLocalBackup(backupDir());
    if (!last || Date.now() - last.getTime() > OVERDUE_MS) setTimeout(backup, STARTUP_DELAY_MS).unref();

    setTimeout(() => {
        backup();
        setInterval(backup, DAY_MS).unref();
    }, msUntilHour(ENV.BACKUPS.HOUR)).unref();
}
