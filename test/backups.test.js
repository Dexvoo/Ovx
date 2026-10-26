import './helpers/setupEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import {
    createBackup,
    backupFilename,
    splitParts,
    saveLocal,
    lastLocalBackup,
} from '../src/features/backups/utils/backup.js';
import { readBackup } from '../src/features/backups/utils/format.js';
import { msUntilHour } from '../src/features/backups/events/backupSchedule.js';

const { ObjectId, Long } = mongoose.mongo.BSON;
const NOW = new Date('2026-10-13T04:00:00Z');

/** A database with these collections (name → documents). */
function fakeDb(data) {
    return /** @type {any} */ ({
        databaseName: 'ovx',
        listCollections: () => ({ toArray: async () => Object.keys(data).map((name) => ({ name })) }),
        collection: (name) => ({
            find: () => ({
                async *[Symbol.asyncIterator]() {
                    yield* data[name];
                },
            }),
        }),
    });
}

test('a backup has every collection except login sessions, and restores exactly, IDs and dates included', async () => {
    const id = new ObjectId();
    const joined = new Date('2024-05-01T12:34:56.789Z');
    const db = fakeDb({
        'user-levels': [{ _id: id, userId: '1', xp: 1250, joinedAt: joined, big: Long.fromString('9007199254740993') }],
        'guild-giveaways': [{ _id: new ObjectId(), prize: 'Nitro', winners: [] }],
        sessions: [{ _id: 'secret-session', session: '{"user":"someone"}' }],
        'system.views': [{ _id: 'x' }],
    });

    const backup = await createBackup(db, NOW);
    assert.equal(backup.filename, 'ovx-backup-2026-10-13-0400.ndjson.gz');
    assert.deepEqual(
        backup.collections.map((collection) => collection.name),
        ['guild-giveaways', 'user-levels']
    );
    assert.equal(backup.documents, 2);

    const { header, collections } = readBackup(backup.buffer);
    assert.equal(header.database, 'ovx');
    assert.equal(collections.has('sessions'), false, 'login sessions are never backed up');
    const [restored] = collections.get('user-levels');
    assert.ok(restored._id instanceof ObjectId && restored._id.equals(id));
    assert.ok(restored.joinedAt instanceof Date);
    assert.equal(restored.joinedAt.toISOString(), joined.toISOString());
    assert.equal(restored.big.toString(), '9007199254740993', 'large numbers are kept exactly');
});

test('a backup too big for one upload is split, and the parts join back into it', async () => {
    const buffer = Buffer.from('x'.repeat(25));
    const parts = splitParts(buffer, 10);
    assert.deepEqual(
        parts.map((part) => part.length),
        [10, 10, 5]
    );
    assert.ok(Buffer.concat(parts).equals(buffer));
    assert.equal(splitParts(Buffer.alloc(0)).length, 1);

    // A real backup survives being split and joined
    const backup = await createBackup(fakeDb({ things: [{ _id: 1, a: 'b' }] }), NOW);
    assert.equal(readBackup(Buffer.concat(splitParts(backup.buffer, 7))).collections.get('things').length, 1);
});

test('only the newest backups are kept in the folder, and other files are left alone', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ovx-backups-'));
    try {
        await fs.writeFile(path.join(dir, 'notes.txt'), 'keep me');
        for (const day of [10, 11, 12]) {
            await saveLocal(
                { filename: backupFilename(new Date(Date.UTC(2026, 9, day, 4))), buffer: Buffer.from('b') },
                { dir, keep: 2 }
            );
        }
        const names = (await fs.readdir(dir)).sort();
        assert.deepEqual(names, [
            'notes.txt',
            'ovx-backup-2026-10-11-0400.ndjson.gz',
            'ovx-backup-2026-10-12-0400.ndjson.gz',
        ]);
        assert.ok(await lastLocalBackup(dir));
        assert.equal(await lastLocalBackup(path.join(dir, 'missing')), null);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('the daily backup waits until the chosen hour (UTC)', () => {
    const hour = 60 * 60 * 1000;
    assert.equal(msUntilHour(4, new Date('2026-10-13T01:00:00Z')), 3 * hour);
    assert.equal(msUntilHour(4, new Date('2026-10-13T04:00:00Z')), 24 * hour, 'exactly on time: the next day');
    assert.equal(msUntilHour(4, new Date('2026-10-13T05:30:00Z')), 22.5 * hour);
});

test("a file that isn't an Ovx backup is refused", async () => {
    const { gzipSync } = await import('node:zlib');
    assert.throws(() => readBackup(gzipSync('{"something":"else"}\n')), /Not an Ovx backup/);
});

test('old uploads in the backup channel are deleted beyond the number kept, parts included', async () => {
    const { pruneUploads } = await import('../src/features/backups/utils/backup.js');
    const deleted = [];
    const upload = (id, name, author = 'bot') => ({
        id,
        author: { id: author },
        attachments: { first: () => ({ name }) },
        delete: async () => deleted.push(id),
    });
    const messages = [
        upload('a', 'ovx-backup-2026-10-10-0400.ndjson.gz.part1'),
        upload('b', 'ovx-backup-2026-10-10-0400.ndjson.gz.part2'),
        upload('c', 'ovx-backup-2026-10-11-0400.ndjson.gz'),
        upload('d', 'ovx-backup-2026-10-12-0400.ndjson.gz'),
        upload('e', 'ovx-backup-2026-10-01-0400.ndjson.gz', 'someone-else'),
        upload('f', 'notes.txt'),
    ];
    const channel = { messages: { fetch: async () => new Map(messages.map((message) => [message.id, message])) } };

    await pruneUploads(channel, 'bot', 2);
    assert.deepEqual(deleted.sort(), ['a', 'b'], 'the oldest backup goes, with all its parts; nothing else is touched');
});
