import { gunzipSync } from 'node:zlib';
import mongoose from 'mongoose';

/**
 * The backup file format, kept apart from the bot's settings so the restore script can read backups
 * on a machine with only a database address set up.
 */

const { EJSON } = mongoose.mongo.BSON;

/** Bumped if the file layout ever changes, so the restore script knows what it's reading. */
export const BACKUP_FORMAT = 1;

/**
 * Reads a backup file (or its parts joined back together) into collections of documents.
 * @param {Buffer} buffer
 * @returns {{ header: any, collections: Map<string, any[]> }}
 */
export function readBackup(buffer) {
    const lines = gunzipSync(buffer).toString('utf8').split('\n').filter(Boolean);
    const header = JSON.parse(lines[0] ?? '{}');
    if (header.format !== BACKUP_FORMAT) throw new Error(`Not an Ovx backup, or an unknown format (${header.format})`);
    /** @type {Map<string, any[]>} */
    const collections = new Map();
    for (const line of lines.slice(1)) {
        const { c, d } = JSON.parse(line);
        if (!collections.has(c)) collections.set(c, []);
        collections.get(c).push(EJSON.deserialize(d, { relaxed: false }));
    }
    return { header, collections };
}

