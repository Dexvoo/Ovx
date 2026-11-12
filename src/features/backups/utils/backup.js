import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import mongoose from 'mongoose';
import { AttachmentBuilder } from 'discord.js';
import { ENV } from '../../../bootstrap/environment.js';
import { LogData } from '../../../shared/utils/logger.js';

import { BACKUP_FORMAT } from './format.js';

const { EJSON } = mongoose.mongo.BSON;
/** Login sessions: temporary, and copying them would spread working logins into every backup. */
const SKIPPED_COLLECTIONS = new Set(['sessions']);
/** Discord's upload limit for bots is 10 MB; parts stay safely under it. */
export const PART_BYTES = 8 * 1024 * 1024;
/** The project folder, so BACKUP_DIR means the same place however the bot is started. */
const PROJECT_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** The backups folder as a full path. */
export const backupDir = () => path.resolve(PROJECT_ROOT, ENV.BACKUPS.DIR);

const FILE_PATTERN = /^ovx-backup-\d{4}-\d{2}-\d{2}-\d{4}\.ndjson\.gz$/;

/**
 * @typedef {{ name: string, count: number }} CollectionStats
 * @typedef {{ filename: string, buffer: Buffer, collections: CollectionStats[], documents: number, createdAt: Date }} Backup
 */

/** "ovx-backup-2026-10-13-0400.ndjson.gz", in UTC so files sort by date. */
export function backupFilename(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `ovx-backup-${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}.ndjson.gz`;
}

/**
 * Exports every collection to one gzipped file of JSON lines: a header line, then one line per document,
 * in MongoDB's Extended JSON, so dates, IDs and numbers come back exactly as they were.
 * @param {import('mongodb').Db} db
 * @param {Date} [now]
 * @returns {Promise<Backup>}
 */
export async function createBackup(db, now = new Date()) {
    const names = (await db.listCollections({}, { nameOnly: true }).toArray())
        .map((collection) => collection.name)
        .filter((name) => !SKIPPED_COLLECTIONS.has(name) && !name.startsWith('system.'))
        .sort();

    const gzip = createGzip({ level: 9 });
    const chunks = [];
    gzip.on('data', (chunk) => chunks.push(chunk));
    const finished = new Promise((resolve, reject) => {
        gzip.on('end', resolve);
        gzip.on('error', reject);
    });
    const write = (line) =>
        new Promise((resolve) => {
            if (gzip.write(`${line}\n`)) resolve(undefined);
            else gzip.once('drain', resolve);
        });

    /** @type {CollectionStats[]} */
    const collections = [];
    await write(JSON.stringify({ format: BACKUP_FORMAT, createdAt: now.toISOString(), database: db.databaseName }));
    for (const name of names) {
        let count = 0;
        for await (const doc of db.collection(name).find({})) {
            await write(JSON.stringify({ c: name, d: EJSON.serialize(doc, { relaxed: false }) }));
            count++;
        }
        collections.push({ name, count });
    }
    gzip.end();
    await finished;

    return {
        filename: backupFilename(now),
        buffer: Buffer.concat(chunks),
        collections,
        documents: collections.reduce((total, collection) => total + collection.count, 0),
        createdAt: now,
    };
}

/**
 * Saves a backup in the backups folder and deletes the oldest beyond `keep`.
 * @param {Backup} backup
 * @param {{ dir: string, keep: number }} options
 * @returns {Promise<string>} The saved file's path
 */
export async function saveLocal(backup, { dir, keep }) {
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, backup.filename);
    await fs.writeFile(file, backup.buffer);

    const existing = (await fs.readdir(dir)).filter((name) => FILE_PATTERN.test(name)).sort();
    for (const old of existing.slice(0, Math.max(0, existing.length - keep))) {
        await fs.rm(path.join(dir, old), { force: true });
    }
    return file;
}

/**
 * When the newest local backup was made, or null if there's none.
 * @param {string} dir
 */
export async function lastLocalBackup(dir) {
    const names = (await fs.readdir(dir).catch(() => [])).filter((name) => FILE_PATTERN.test(name)).sort();
    const newest = names.at(-1);
    if (!newest) return null;
    return (await fs.stat(path.join(dir, newest))).mtime;
}

/**
 * Splits a file into parts small enough to upload. Joining the parts' bytes in order gives the file back.
 * @param {Buffer} buffer
 * @param {number} [size]
 */
export function splitParts(buffer, size = PART_BYTES) {
    const parts = [];
    for (let start = 0; start < buffer.length; start += size) parts.push(buffer.subarray(start, start + size));
    return parts.length > 0 ? parts : [buffer];
}

/**
 * Uploads a backup to a private channel, in parts if it's too big for one upload.
 * @param {import('discord.js').Client} client
 * @param {string} channelId
 * @param {Backup} backup
 * @param {number} [keep] - Older uploads beyond this many backups are deleted
 */
export async function uploadBackup(client, channelId, backup, keep = Infinity) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isSendable()) throw new Error(`Can't post in the backup channel (${channelId})`);

    const parts = splitParts(backup.buffer);
    const size = `${(backup.buffer.length / 1024 / 1024).toFixed(2)} MB`;
    const summary = `**Backup** <t:${Math.floor(backup.createdAt.getTime() / 1000)}:f> · ${backup.collections.length} collections · ${backup.documents.toLocaleString('en-GB')} documents · ${size}`;

    for (const [index, part] of parts.entries()) {
        const name = parts.length === 1 ? backup.filename : `${backup.filename}.part${index + 1}`;
        await channel.send({
            content: parts.length === 1 ? summary : `${summary} · part ${index + 1} of ${parts.length}`,
            files: [new AttachmentBuilder(part, { name })],
            allowedMentions: { parse: [] },
        });
    }
    await pruneUploads(channel, client.user.id, keep);
}

/** "ovx-backup-2026-10-13-0400.ndjson.gz" from an uploaded file's name (parts share it) */
const UPLOAD_NAME = /^(ovx-backup-\d{4}-\d{2}-\d{2}-\d{4}\.ndjson\.gz)(?:\.part\d+)?$/;

/**
 * Deletes Ovx's backup uploads beyond the newest `keep` backups, so the channel holds the same window
 * as the backups folder (and deleted data doesn't live on in old uploads).
 * @param {any} channel - The backup channel
 * @param {string} botId
 * @param {number} keep
 */
export async function pruneUploads(channel, botId, keep) {
    if (!Number.isFinite(keep)) return;
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages) return;

    /** backup filename → its messages */
    const backups = new Map();
    for (const message of messages.values()) {
        if (message.author?.id !== botId) continue;
        const name = message.attachments.first()?.name;
        const match = name && UPLOAD_NAME.exec(name);
        if (!match) continue;
        if (!backups.has(match[1])) backups.set(match[1], []);
        backups.get(match[1]).push(message);
    }
    const old = [...backups.keys()].sort().slice(0, Math.max(0, backups.size - keep));
    for (const name of old) {
        for (const message of backups.get(name)) await message.delete().catch(() => {});
    }
}

let running = null;

/**
 * Makes a backup, keeps it locally and uploads it (if a backup channel is set). Only one runs at a time.
 * @param {import('discord.js').Client} client
 * @returns {Promise<{ backup: Backup, file: string, uploaded: boolean }>}
 */
export function runBackup(client) {
    if (running) return running;
    running = (async () => {
        const started = Date.now();
        const backup = await createBackup(mongoose.connection.db);
        const file = await saveLocal(backup, { dir: backupDir(), keep: ENV.BACKUPS.KEEP });

        let uploaded = false;
        if (ENV.BACKUPS.CHANNEL_ID) {
            await uploadBackup(client, ENV.BACKUPS.CHANNEL_ID, backup, ENV.BACKUPS.KEEP);
            uploaded = true;
        }
        LogData(
            'Backup',
            `${backup.documents} documents in ${backup.collections.length} collections, ${backup.buffer.length} bytes, ${Date.now() - started} ms${uploaded ? ', uploaded' : ''}`,
            'success'
        );
        return { backup, file, uploaded };
    })().finally(() => {
        running = null;
    });
    return running;
}
