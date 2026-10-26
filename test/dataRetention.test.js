import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ShardClientUtil } from 'discord.js';
import { GuildDeparture } from '../src/features/dataRetention/models/guildDeparture.js';
import { GuildSettings } from '../src/shared/models/guildSettings.js';
import { UsageDay } from '../src/features/usage/models/usageDay.js';
import {
    GUILD_DATA_MODELS,
    DATA_RETENTION_DAYS,
    deleteGuildData,
    reconcileGuilds,
    sweepDepartedGuilds,
    isOnThisShard,
} from '../src/features/dataRetention/utils/retention.js';

const DAY = 24 * 60 * 60 * 1000;
const PRESENT = '400000000000000001';
const GONE = '400000000000000002';
const NOW = new Date('2026-10-12T12:00:00Z');

/** guildId → leftAt */
let departures;
/** model → guildIds it holds */
let stored;
let settings;
let usagePulls;

/** @param {string[]} guildIds */
const fakeClient = (guildIds, shard = null) => ({
    guilds: { cache: new Map(guildIds.map((id) => [id, { id }])) },
    shard,
});

beforeEach(() => {
    departures = new Map();
    stored = new Map(GUILD_DATA_MODELS.map((model) => [model, []]));
    settings = [];

    GuildDeparture.updateOne = /** @type {any} */ (
        async ({ guildId }, { $min: { leftAt } }) => {
            const current = departures.get(guildId);
            departures.set(guildId, current && current < leftAt ? current : leftAt);
        }
    );
    GuildDeparture.deleteMany = /** @type {any} */ (
        async ({ guildId: { $in } }) => $in.forEach((id) => departures.delete(id))
    );
    GuildDeparture.deleteOne = /** @type {any} */ (async ({ guildId }) => departures.delete(guildId));
    GuildDeparture.distinct = /** @type {any} */ (async () => [...departures.keys()]);
    GuildDeparture.find = /** @type {any} */ (
        ({ leftAt: { $lte } }) => ({
            lean: async () =>
                [...departures]
                    .filter(([, leftAt]) => leftAt <= $lte)
                    .map(([guildId, leftAt]) => ({ guildId, leftAt })),
        })
    );

    for (const model of GUILD_DATA_MODELS) {
        model.deleteMany = /** @type {any} */ (
            async ({ guildId }) => {
                const ids = stored.get(model);
                const before = ids.length;
                stored.set(
                    model,
                    ids.filter((id) => id !== guildId)
                );
                return { deletedCount: before - stored.get(model).length };
            }
        );
        model.distinct = /** @type {any} */ (async () => [...new Set(stored.get(model))]);
    }

    usagePulls = [];
    UsageDay.updateMany = /** @type {any} */ (async (filter) => usagePulls.push(filter.guilds));
    GuildSettings.distinct = /** @type {any} */ (async () => settings.map((doc) => doc.guildId));
    GuildSettings.deleteOne = /** @type {any} */ (
        async ({ guildId }) => {
            const index = settings.findIndex(
                (doc) => doc.guildId === guildId && (!doc.premiumUntil || doc.premiumUntil <= NOW)
            );
            if (index === -1) return { deletedCount: 0 };
            settings.splice(index, 1);
            return { deletedCount: 1 };
        }
    );
    GuildSettings.updateOne = /** @type {any} */ (
        async ({ guildId }, { $set }) => Object.assign(settings.find((doc) => doc.guildId === guildId) ?? {}, $set)
    );
});

test('deleteGuildData removes the server from every collection, and only that server', async () => {
    for (const model of GUILD_DATA_MODELS) stored.set(model, [GONE, PRESENT]);
    settings.push({ guildId: GONE, premiumUntil: null }, { guildId: PRESENT, premiumUntil: null });
    departures.set(GONE, new Date(NOW.getTime() - 40 * DAY));

    const deleted = await deleteGuildData(GONE, NOW);

    assert.equal(deleted, GUILD_DATA_MODELS.length + 1);
    for (const model of GUILD_DATA_MODELS) assert.deepEqual(stored.get(model), [PRESENT], model.modelName);
    assert.deepEqual(
        settings.map((doc) => doc.guildId),
        [PRESENT]
    );
    assert.equal(departures.has(GONE), false);
    assert.deepEqual(usagePulls, [GONE], 'taken out of the usage stats too');
});

test('deleteGuildData keeps active premium but clears the other bot settings', async () => {
    const premiumUntil = new Date(NOW.getTime() + 10 * DAY);
    settings.push({ guildId: GONE, premiumUntil, embedColour: '#aa88ff', bio: 'Hello' });

    await deleteGuildData(GONE, NOW);

    assert.deepEqual(settings, [{ guildId: GONE, premiumUntil, embedColour: null, bio: null }]);
});

test(`sweep deletes servers gone for ${DATA_RETENTION_DAYS} days, not sooner`, async () => {
    const recent = '400000000000000003';
    for (const model of GUILD_DATA_MODELS) stored.set(model, [GONE, recent]);
    departures.set(GONE, new Date(NOW.getTime() - DATA_RETENTION_DAYS * DAY));
    departures.set(recent, new Date(NOW.getTime() - (DATA_RETENTION_DAYS - 1) * DAY));

    const deletedFor = await sweepDepartedGuilds(/** @type {any} */ (fakeClient([PRESENT])), NOW);

    assert.deepEqual(deletedFor, [GONE]);
    assert.deepEqual(stored.get(GUILD_DATA_MODELS[0]), [recent]);
    assert.equal(departures.has(recent), true);
});

test('sweep never deletes a server Ovx is in, even if it was marked as gone', async () => {
    for (const model of GUILD_DATA_MODELS) stored.set(model, [PRESENT]);
    departures.set(PRESENT, new Date(NOW.getTime() - 60 * DAY));

    const deletedFor = await sweepDepartedGuilds(/** @type {any} */ (fakeClient([PRESENT])), NOW);

    assert.deepEqual(deletedFor, []);
    assert.deepEqual(stored.get(GUILD_DATA_MODELS[0]), [PRESENT]);
    assert.equal(departures.has(PRESENT), false);
});

test('reconcile marks servers that removed Ovx while it was offline, and unmarks ones it is in', async () => {
    stored.set(GUILD_DATA_MODELS[0], [GONE]);
    settings.push({ guildId: PRESENT, premiumUntil: null });
    departures.set(PRESENT, new Date(NOW.getTime() - 5 * DAY));

    const gone = await reconcileGuilds(/** @type {any} */ (fakeClient([PRESENT])));

    assert.equal(gone, 1);
    assert.deepEqual([...departures.keys()], [GONE]);
});

test('reconcile keeps the original date of a server already marked', async () => {
    stored.set(GUILD_DATA_MODELS[0], [GONE]);
    const leftAt = new Date(NOW.getTime() - 20 * DAY);
    departures.set(GONE, leftAt);

    assert.equal(await reconcileGuilds(/** @type {any} */ (fakeClient([PRESENT]))), 0);
    assert.equal(departures.get(GONE), leftAt);
});

test('reconcile does nothing when the shard sees no servers', async () => {
    stored.set(GUILD_DATA_MODELS[0], [GONE]);
    assert.equal(await reconcileGuilds(/** @type {any} */ (fakeClient([]))), 0);
    assert.equal(departures.size, 0);
});

test('each shard only handles its own servers', async () => {
    const shard = { ids: [ShardClientUtil.shardIdForGuildId(GONE, 2)], count: 2 };
    const other = Array.from({ length: 50 }, (_, i) => String(400000000000000000n + (BigInt(i) << 22n))).find(
        (id) => ShardClientUtil.shardIdForGuildId(id, 2) !== shard.ids[0]
    );
    const client = /** @type {any} */ (fakeClient([PRESENT], shard));

    assert.equal(isOnThisShard(client, GONE), true);
    assert.equal(isOnThisShard(client, other), false);

    departures.set(GONE, new Date(NOW.getTime() - 40 * DAY));
    departures.set(other, new Date(NOW.getTime() - 40 * DAY));
    assert.deepEqual(await sweepDepartedGuilds(client, NOW), [GONE]);
    assert.equal(departures.has(other), true);
});

test('every model with a guildId is deleted by the cleanup', async () => {
    const { default: mongoose } = await import('mongoose');
    const { readdirSync } = await import('node:fs');
    const src = new URL('../src/', import.meta.url);

    // Load every model file, so a new one can't be missed
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' })
        .map((file) => file.replaceAll('\\', '/'))
        .filter((file) => /\/models\/[^/]+\.js$/.test(file));
    assert.ok(files.length >= 12, `found only ${files.length} model files`);
    for (const file of files) await import(new URL(file, src).href);

    const handled = new Set([...GUILD_DATA_MODELS, GuildSettings, GuildDeparture].map((model) => model.modelName));
    const missing = mongoose
        .modelNames()
        .filter((name) => mongoose.model(name).schema.path('guildId') && !handled.has(name));
    assert.deepEqual(missing, []);
});
