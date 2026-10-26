import './helpers/setupEnv.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createShardBridge } from '../src/dashboard/shardBridge.js';
import { createDashboardApp } from '../src/dashboard/server.js';
import { statusLines, totalServers } from '../src/features/utility/events/presence.js';
import { userInstallUrl, inviteUrl } from '../src/shared/utils/invite.js';
import { commandData as inviteCommand } from '../src/features/utility/commands/invite.js';

/** A shard that is up and answers, up but stuck, or not running. */
const shard = (state) => ({
    ready: state !== 'not-running',
    eval: async () => {
        if (state === 'stuck') return new Promise(() => {});
        if (state === 'crashed') throw new Error('Shard died');
        return { ready: state === 'online', ping: 42.6 };
    },
});

test('each shard is checked on its own, so one down shard shows as down instead of failing the check', async () => {
    const manager = /** @type {any} */ ({
        totalShards: 5,
        shards: new Map([
            [0, shard('online')],
            [1, shard('reconnecting')],
            [2, shard('crashed')],
            [3, shard('stuck')],
            // Shard 4 hasn't started yet
        ]),
    });
    const health = await createShardBridge(manager).health(50);
    assert.deepEqual(health, [
        { id: 0, status: 'online', ping: 43 },
        { id: 1, status: 'reconnecting', ping: 43 },
        { id: 2, status: 'down', ping: null },
        { id: 3, status: 'down', ping: null },
        { id: 4, status: 'down', ping: null },
    ]);
});

const env = /** @type {any} */ ({
    APPLICATION_ID: '100000000000000000',
    DEVELOPER_IDS: [],
    DASHBOARD: {
        PORT: 0,
        HOST: '127.0.0.1',
        URL: 'http://localhost:3000',
        SECURE: false,
        TRUST_PROXY: false,
        CLIENT_SECRET: 'client-secret',
        SESSION_SECRET: 'test-session-secret-that-is-long-enough',
    },
});
const servers = [];
after(() => servers.forEach((server) => server.close()));

/** The dashboard with shards in these states. */
async function dashboard(statuses) {
    let checks = 0;
    const bridge = /** @type {any} */ ({
        health: async () => (
            checks++,
            statuses.map((status, id) => ({ id, status, ping: status === 'online' ? 40 : null }))
        ),
    });
    const app = createDashboardApp({
        bridge,
        env,
        auditStore: /** @type {any} */ ({ record: async () => {}, list: async () => ({ entries: [] }) }),
        caseStore: /** @type {any} */ ({ list: async () => ({ cases: [] }), remove: async () => null }),
    });
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    servers.push(server);
    const base = `http://127.0.0.1:${server.address().port}`;
    return { get: () => fetch(`${base}/api/public/health`), checks: () => checks, page: () => fetch(`${base}/status`) };
}

test('the public health check says 200 when everything works and 503 otherwise, for uptime monitors', async () => {
    const up = await dashboard(['online', 'online']);
    const ok = await up.get();
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).status, 'operational');

    const partly = await dashboard(['online', 'down']);
    const degraded = await partly.get();
    assert.equal(degraded.status, 503);
    assert.equal((await degraded.json()).status, 'degraded');

    const all = await dashboard(['down']);
    assert.equal((await (await all.get()).json()).status, 'down');
});

test('the health check is cached briefly, and the status page loads for anyone', async () => {
    const site = await dashboard(['online']);
    await site.get();
    await site.get();
    assert.equal(site.checks(), 1, 'shards are asked once, not on every request');
    assert.equal((await site.page()).status, 200);
});

test('the bot status shows the help command, the server count and the shard', async () => {
    const client = /** @type {any} */ ({
        guilds: { cache: { size: 3 } },
        shard: { ids: [2], fetchClientValues: async () => [100, 185] },
    });
    assert.equal(await totalServers(client), 285);
    assert.deepEqual(statusLines(client, 285), ['/help · ovxbot.com', 'Watching 285 servers', 'Shard #2']);

    // Other shards still starting: this shard's own count
    client.shard.fetchClientValues = async () => {
        throw new Error('Still spawning');
    };
    assert.equal(await totalServers(client), 3);
});

test('/invite links add Ovx to a server or to your account, and works everywhere', () => {
    const account = new URL(userInstallUrl('100000000000000000'));
    assert.equal(account.searchParams.get('integration_type'), '1');
    assert.equal(account.searchParams.get('scope'), 'applications.commands');
    assert.match(new URL(inviteUrl('100000000000000000')).searchParams.get('scope'), /bot/);
    assert.deepEqual(inviteCommand.toJSON().contexts, [0, 1, 2]);
});
