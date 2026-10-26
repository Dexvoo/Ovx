// Restores an Ovx backup into MongoDB. Run from the project folder:
//
//   npm run restore -- backups/ovx-backup-2026-10-13-0400.ndjson.gz
//   npm run restore -- part1-file part2-file          (a backup uploaded in parts: list them in order)
//
// Without --yes it only shows what it would do. Options:
//   --yes                 actually restore
//   --replace             empty collections that already have data before restoring them (otherwise they're skipped)
//   --only a,b            only these collections
//   --uri <uri>           restore into this database instead of MONGO_URI from .env (e.g. a test database)
//
// Stop the bot first, so it doesn't write to the database while it's being restored.

import fs from 'node:fs';
import mongoose from 'mongoose';
import { readBackup } from '../src/features/backups/utils/format.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : null;
};
const files = args.filter(
    (arg, index) => !arg.startsWith('--') && args[index - 1] !== '--only' && args[index - 1] !== '--uri'
);

if (files.length === 0) {
    console.log(
        'Usage: npm run restore -- <backup file> [more parts...] [--yes] [--replace] [--only a,b] [--uri <uri>]'
    );
    process.exit(1);
}

try {
    process.loadEnvFile();
} catch {
    // MONGO_URI may come from the environment instead
}
const uri = option('uri') ?? process.env.MONGO_URI;
if (!uri) {
    console.error('No database: set MONGO_URI in .env, or pass --uri.');
    process.exit(1);
}
/** The database's host, without the username and password. */
const where = (() => {
    try {
        const url = new URL(uri);
        return `${url.host}${url.pathname}`;
    } catch {
        return 'the database';
    }
})();

const { header, collections } = readBackup(Buffer.concat(files.map((file) => fs.readFileSync(file))));
const only =
    option('only')
        ?.split(',')
        .map((name) => name.trim())
        .filter(Boolean) ?? null;
const chosen = [...collections.keys()].filter((name) => (!only || only.includes(name)) && name !== 'sessions');

console.log(`Backup from ${header.createdAt} (database "${header.database}")`);
console.log(`Restoring into ${where}${flag('yes') ? '' : '  [dry run: add --yes to restore]'}\n`);

const client = new mongoose.mongo.MongoClient(uri);
await client.connect();
const db = client.db();
let problems = 0;

try {
    for (const name of chosen) {
        const docs = collections.get(name);
        const existing = await db.collection(name).countDocuments();
        const line = `  ${name.padEnd(36)} ${String(docs.length).padStart(7)} in backup, ${String(existing).padStart(7)} now`;

        if (existing > 0 && !flag('replace')) {
            console.log(`${line}  → skipped (has data; use --replace)`);
            continue;
        }
        if (!flag('yes')) {
            console.log(`${line}  → would ${existing > 0 ? 'replace' : 'restore'}`);
            continue;
        }
        if (existing > 0) await db.collection(name).deleteMany({});
        if (docs.length > 0) await db.collection(name).insertMany(docs, { ordered: false });
        console.log(`${line}  → restored`);
    }
} catch (error) {
    problems++;
    console.error(`\nRestore failed: ${error.message}`);
} finally {
    await client.close();
}

if (!flag('yes')) console.log('\nNothing was changed. Run again with --yes to restore.');
process.exit(problems ? 1 : 0);
