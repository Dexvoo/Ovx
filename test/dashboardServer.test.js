import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardApp } from '../src/dashboard/server.js';
import { safeReturnPath } from '../src/dashboard/auth.js';

const USER_ID = '300000000000000001';
const DEV_ID = '300000000000000002';
const GUILD_ID = '400000000000000001';
const OTHER_GUILD = '400000000000000002';

const realFetch = globalThis.fetch;
let server;
let base;
let bridgeCalls;
let shardsDown;
let discordUser;

let denyAccess;
let saveChanges;

// In-memory Web Logs store
const auditEntries = [];
const auditQueries = [];
const auditStore = {
    async record(entry) {
        auditEntries.push(entry);
    },
    async list(guildId, filters) {
        auditQueries.push({ guildId, filters });
        return { entries: auditEntries.filter((entry) => entry.guildId === guildId), nextCursor: null };
    },
};

// In-memory moderation cases
const cases = [];
const caseQueries = [];
const caseStore = {
    async list(guildId, filters) {
        caseQueries.push({ guildId, filters });
        return { cases: cases.filter((entry) => entry.guildId === guildId), nextCursor: null };
    },
    async remove(guildId, number) {
        const index = cases.findIndex((entry) => entry.guildId === guildId && entry.number === number);
        return index === -1 ? null : cases.splice(index, 1)[0];
    },
};

// Fake shards: records calls and returns canned results
const bridge = {
    async guild(action, guildId, payload) {
        if (shardsDown) throw new Error('Shard 0 is not ready');
        bridgeCalls.push({ action, guildId, payload });
        if (action === 'leaderboard' && !payload.viewerId)
            return { ok: false, status: 404, error: 'Leaderboard not found' };
        if (action === 'access' && denyAccess)
            return { ok: false, status: 403, error: 'You need the Manage Server permission' };
        if (
            action.startsWith('save') ||
            ['resetSettings', 'postTicketPanel', 'addStream', 'removeStream'].includes(action)
        ) {
            return { ok: true, data: { action, guildId }, changes: saveChanges };
        }
        return { ok: true, data: { action, guildId } };
    },
    async botGuildIds(ids) {
        return new Set(ids.filter((id) => id === GUILD_ID));
    },
    async stats() {
        return [{ shardId: 0, guilds: 3, members: 40 }];
    },
};

const env = {
    APPLICATION_ID: '100000000000000000',
    DEVELOPER_IDS: [DEV_ID],
    DASHBOARD: {
        PORT: 0,
        HOST: '127.0.0.1',
        URL: 'http://localhost:3000',
        SECURE: false,
        TRUST_PROXY: false,
        CLIENT_SECRET: 'client-secret',
        SESSION_SECRET: 'test-session-secret-that-is-long-enough',
    },
};
const ORIGIN = 'http://localhost:3000';

before(async () => {
    // High limits so the many logins below don't trip the limiter; it's tested separately
    const app = createDashboardApp({
        bridge,
        env,
        auditStore,
        caseStore,
        rateLimits: { auth: 1000, api: 1000, writes: 1000 },
    });
    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;

    // Fake Discord API; everything else goes to the real fetch (our test server)
    globalThis.fetch = async (url, init) => {
        const href = String(url);
        if (!href.startsWith('https://discord.com/api/')) return realFetch(url, init);
        if (href.endsWith('/oauth2/token')) return Response.json({ access_token: 'discord-token' });
        if (href.endsWith('/oauth2/token/revoke')) return new Response(null, { status: 200 });
        if (href.endsWith('/users/@me')) return Response.json(discordUser);
        if (href.endsWith('/users/@me/guilds')) {
            return Response.json([
                { id: GUILD_ID, name: 'Managed', icon: null, owner: false, permissions: String(0x20) },
                { id: OTHER_GUILD, name: 'Member only', icon: null, owner: false, permissions: '0' },
            ]);
        }
        return new Response(null, { status: 404 });
    };
});

after(() => {
    globalThis.fetch = realFetch;
    server.close();
});

beforeEach(() => {
    bridgeCalls = [];
    shardsDown = false;
    denyAccess = false;
    saveChanges = ['Max level: 100 → 10'];
    auditEntries.length = 0;
    auditQueries.length = 0;
    cases.length = 0;
    caseQueries.length = 0;
    discordUser = { id: USER_ID, username: 'tester', global_name: 'Tester', avatar: null };
});

/** Minimal cookie jar so requests act like one browser */
function browser() {
    let cookie = '';
    return {
        get cookie() {
            return cookie;
        },
        async request(path, init = {}) {
            const response = await realFetch(base + path, {
                redirect: 'manual',
                ...init,
                headers: { ...(cookie ? { cookie } : {}), ...init.headers },
            });
            const setCookie = response.headers.get('set-cookie');
            if (setCookie) cookie = setCookie.split(';')[0];
            return response;
        },
    };
}

/** Runs the full Discord login flow and returns the logged-in browser */
async function login(user) {
    if (user) discordUser = user;
    const client = browser();
    const start = await client.request('/auth/login');
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const callback = await client.request(`/auth/callback?code=abc&state=${state}`);
    assert.equal(callback.status, 302);
    return client;
}

const json = (body, method = 'PUT') => ({
    method,
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify(body),
});

test('sends security headers and hides the framework', async () => {
    const response = await browser().request('/');
    const csp = response.headers.get('content-security-policy');

    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/, 'cannot be embedded in other sites (clickjacking)');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-powered-by'), null);
});

test('API requires login', async () => {
    const response = await browser().request('/api/me');
    assert.equal(response.status, 401);
});

test('no session cookie is set for visitors who never log in', async () => {
    const response = await browser().request('/api/me');
    assert.equal(response.headers.get('set-cookie'), null);
});

test('login redirects to Discord with a random state and the configured callback', async () => {
    const client = browser();
    const response = await client.request('/auth/login');
    const location = new URL(response.headers.get('location'));

    assert.equal(location.origin + location.pathname, 'https://discord.com/oauth2/authorize');
    assert.equal(location.searchParams.get('redirect_uri'), 'http://localhost:3000/auth/callback');
    assert.equal(location.searchParams.get('scope'), 'identify guilds');
    assert.ok(location.searchParams.get('state').length >= 40);
    assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(response.headers.get('set-cookie'), /SameSite=Lax/i);
});

test('the callback rejects a wrong or missing state (login CSRF)', async () => {
    const client = browser();
    await client.request('/auth/login');

    const wrong = await client.request('/auth/callback?code=abc&state=attacker-state');
    assert.equal(wrong.headers.get('location'), '/?login=expired');

    const freshBrowser = await browser().request('/auth/callback?code=abc&state=anything');
    assert.equal(freshBrowser.headers.get('location'), '/?login=expired');
});

test('a state can only be used once', async () => {
    const client = browser();
    const start = await client.request('/auth/login');
    const state = new URL(start.headers.get('location')).searchParams.get('state');

    await client.request(`/auth/callback?code=abc&state=${state}`);
    const replay = await client.request(`/auth/callback?code=abc&state=${state}`);
    assert.equal(replay.headers.get('location'), '/?login=expired');
});

test('login issues a new session ID (session fixation) and lists only managed servers', async () => {
    const client = browser();
    const start = await client.request('/auth/login');
    const cookieBeforeLogin = client.cookie;
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    await client.request(`/auth/callback?code=abc&state=${state}`);

    assert.notEqual(client.cookie, cookieBeforeLogin);

    const me = await (await client.request('/api/me')).json();
    assert.equal(me.user.id, USER_ID);
    assert.equal(me.user.isDeveloper, false);
    assert.deepEqual(
        me.guilds.map((guild) => [guild.id, guild.botPresent]),
        [[GUILD_ID, true]],
        'servers without Manage Server are left out'
    );
});

test('the user ID always comes from the session, never the request', async () => {
    const client = await login();
    await client.request(`/api/guilds/${GUILD_ID}/levels`, json({ maxLevel: 10, userId: DEV_ID }));

    const save = bridgeCalls.find((call) => call.action === 'saveLevelSettings');
    assert.equal(save.payload.userId, USER_ID);
    assert.equal(save.guildId, GUILD_ID);
});

test('saving requires the dashboard origin (CSRF)', async () => {
    const client = await login();
    const path = `/api/guilds/${GUILD_ID}/levels`;
    const body = JSON.stringify({ maxLevel: 10 });

    const noOrigin = await client.request(path, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body,
    });
    assert.equal(noOrigin.status, 403);

    const evil = await client.request(path, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
        body,
    });
    assert.equal(evil.status, 403);
    assert.equal(bridgeCalls.length, 0, 'nothing reached the bot');
});

test('saving requires a JSON body, so plain HTML forms from other sites cannot post', async () => {
    const client = await login();
    const response = await client.request(`/api/guilds/${GUILD_ID}/levels`, {
        method: 'PUT',
        headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN },
        body: 'maxLevel=10',
    });
    assert.equal(response.status, 415);
});

test('malformed and oversized JSON are rejected without leaking details', async () => {
    const client = await login();
    const path = `/api/guilds/${GUILD_ID}/levels`;

    const bad = await client.request(path, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: '{',
    });
    assert.equal(bad.status, 400);
    assert.deepEqual(await bad.json(), { error: 'Invalid JSON' });

    const huge = await client.request(path, json({ levelUpMessage: 'x'.repeat(40_000) }));
    assert.equal(huge.status, 413);
});

test('invalid guild IDs never reach the bot', async () => {
    const client = await login();
    const response = await client.request('/api/guilds/not-an-id');
    assert.equal(response.status, 404);
    assert.equal(bridgeCalls.length, 0);
});

test('shard errors come back as 503 instead of crashing', async () => {
    const client = await login();
    shardsDown = true;
    const response = await client.request(`/api/guilds/${GUILD_ID}`);
    assert.equal(response.status, 503);
});

test('the developer panel is hidden (404) from non-developers', async () => {
    const regular = await login();
    assert.equal((await regular.request('/api/dev/stats')).status, 404);

    const developer = await login({ id: DEV_ID, username: 'dev', global_name: null, avatar: null });
    const response = await developer.request('/api/dev/stats');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).totals.guilds, 3);
});

test('public leaderboards need no login but respect the server opting in', async () => {
    const response = await browser().request(`/api/public/leaderboard/${GUILD_ID}?type=level`);
    assert.equal(response.status, 404, 'fake bridge reports it as not public');
    assert.equal(bridgeCalls[0].payload.viewerId, undefined, 'no viewer, so the shard applies the public check');
});

test('landing page numbers need no login, are cached, and the invite link lets you pick a server', async () => {
    let calls = 0;
    const realStats = bridge.stats;
    bridge.stats = async () => {
        calls++;
        return [
            { shardId: 0, guilds: 3, members: 40 },
            { shardId: 1, guilds: 2, members: 10 },
        ];
    };
    try {
        const first = await (await browser().request('/api/public/stats')).json();
        assert.equal(first.guilds, 5);
        assert.equal(first.members, 50);
        const invite = new URL(first.inviteUrl);
        assert.equal(invite.searchParams.get('client_id'), env.APPLICATION_ID);
        assert.equal(invite.searchParams.get('guild_id'), null);

        await browser().request('/api/public/stats');
        assert.equal(calls, 1, 'second visitor gets the cached totals');
        assert.deepEqual(Object.keys(first).sort(), ['guilds', 'inviteUrl', 'members']);
    } finally {
        bridge.stats = realStats;
    }
});

test('the legal pages keep their old ovxbot.com addresses', async () => {
    for (const path of ['/tos', '/privacypolicy']) {
        const response = await browser().request(path);
        assert.equal(response.status, 200, path);
        assert.match(response.headers.get('content-type'), /text\/html/);
    }
});

test('logout ends the session', async () => {
    const client = await login();
    const logout = await client.request('/auth/logout', { method: 'POST', headers: { origin: ORIGIN } });
    assert.equal(logout.status, 204);
    assert.equal((await client.request('/api/me')).status, 401);
});

test('logout is also protected against cross-site requests', async () => {
    const client = await login();
    const logout = await client.request('/auth/logout', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
    });
    assert.equal(logout.status, 403);
    assert.equal((await client.request('/api/me')).status, 200);
});

test('return paths after login cannot point to other sites (open redirect)', () => {
    assert.equal(safeReturnPath('/servers/123'), '/servers/123');
    for (const evil of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil', undefined, ['/']]) {
        assert.equal(safeReturnPath(evil), '/', String(evil));
    }
});

test('UI routes serve the page, unknown paths 404', async () => {
    const client = browser();
    assert.equal((await client.request(`/servers/${GUILD_ID}`)).status, 200);
    assert.equal((await client.request('/leaderboard/123')).status, 200);
    assert.equal((await client.request('/.env')).status, 404, 'no files outside public/');
    assert.equal((await client.request('/../package.json')).status, 404);
});

test('pages and scripts are always re-checked, so updates show straight away', async () => {
    const client = browser();
    for (const path of ['/', `/servers/${GUILD_ID}`, '/app.js', '/app.css']) {
        assert.equal((await client.request(path)).headers.get('cache-control'), 'no-cache', path);
    }
});

test('logging saves use the session user and need the dashboard origin', async () => {
    const client = await login();
    const path = `/api/guilds/${GUILD_ID}/logging`;

    const blocked = await client.request(path, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
        body: '{}',
    });
    assert.equal(blocked.status, 403);

    await client.request(path, json({ types: {}, userId: DEV_ID }));
    const save = bridgeCalls.find((call) => call.action === 'saveLoggingSettings');
    assert.equal(save.payload.userId, USER_ID);
});

test('login and API requests are rate limited', async () => {
    const limited = createDashboardApp({ bridge, env, rateLimits: { auth: 2, api: 2 } });
    const limitedServer = await new Promise((resolve) => {
        const s = limited.listen(0, '127.0.0.1', () => resolve(s));
    });
    const url = `http://127.0.0.1:${limitedServer.address().port}`;

    try {
        const auth = [];
        for (let i = 0; i < 3; i++) auth.push((await realFetch(`${url}/auth/login`, { redirect: 'manual' })).status);
        assert.deepEqual(auth, [302, 302, 429]);

        const api = [];
        for (let i = 0; i < 3; i++) api.push((await realFetch(`${url}/api/me`)).status);
        assert.deepEqual(api, [401, 401, 429]);
    } finally {
        limitedServer.close();
    }
});

test('saves are recorded in the Web Logs with the logged-in user, without sending changes to the browser', async () => {
    const client = await login();
    const response = await client.request(`/api/guilds/${GUILD_ID}/levels`, json({ maxLevel: 10 }));

    assert.equal(response.status, 200);
    assert.equal('changes' in (await response.json()), false);
    assert.equal(auditEntries.length, 1);
    assert.deepEqual(
        { guildId: auditEntries[0].guildId, userId: auditEntries[0].user.id, action: auditEntries[0].action },
        { guildId: GUILD_ID, userId: USER_ID, action: 'Updated level settings' }
    );
    assert.deepEqual(auditEntries[0].changes, ['Max level: 100 → 10']);
});

test('bot settings saves go to the shard as the session user and are recorded', async () => {
    saveChanges = ['Nickname: Ovx (default) → Mushy'];
    const client = await login();
    const response = await client.request(`/api/guilds/${GUILD_ID}/bot`, json({ nickname: 'Mushy' }));

    assert.equal(response.status, 200);
    const save = bridgeCalls.find((call) => call.action === 'saveBotSettings');
    assert.deepEqual(save.payload, { userId: USER_ID, settings: { nickname: 'Mushy' } });
    assert.equal(auditEntries[0].action, 'Updated bot settings');
    assert.deepEqual(auditEntries[0].changes, ['Nickname: Ovx (default) → Mushy']);
});

test('saves that change nothing are not recorded', async () => {
    saveChanges = [];
    const client = await login();
    await client.request(`/api/guilds/${GUILD_ID}/logging`, json({ types: {} }));
    assert.equal(auditEntries.length, 0);
});

test('resets go to the shard and are recorded in the Web Logs', async () => {
    saveChanges = ['Levels: on → off'];
    const client = await login();

    const response = await client.request(`/api/guilds/${GUILD_ID}/reset/levels`, json({}, 'POST'));
    assert.equal(response.status, 200);
    const reset = bridgeCalls.find((call) => call.action === 'resetSettings');
    assert.deepEqual(reset.payload, { userId: USER_ID, section: 'levels' });
    assert.equal(auditEntries[0].action, 'Reset level settings');

    const unknown = await client.request(`/api/guilds/${GUILD_ID}/reset/everything`, json({}, 'POST'));
    assert.equal(unknown.status, 404);
    const proto = await client.request(`/api/guilds/${GUILD_ID}/reset/__proto__`, json({}, 'POST'));
    assert.equal(proto.status, 404);
});

test('auto role saves go to the shard as the session user and are recorded', async () => {
    saveChanges = ['Auto roles: off → on'];
    const client = await login();
    const response = await client.request(`/api/guilds/${GUILD_ID}/auto-roles`, json({ enabled: true }));

    assert.equal(response.status, 200);
    const save = bridgeCalls.find((call) => call.action === 'saveAutoRoleSettings');
    assert.deepEqual(save.payload, { userId: USER_ID, settings: { enabled: true } });
    assert.equal(auditEntries[0].action, 'Updated auto roles');
});

test('welcome saves go to the shard as the session user and are recorded', async () => {
    saveChanges = ['Welcome messages: off → on'];
    const client = await login();
    const body = { welcome: { enabled: true, channelId: null, message: null, embed: false, title: null } };
    const response = await client.request(`/api/guilds/${GUILD_ID}/welcome`, json(body));

    assert.equal(response.status, 200);
    const save = bridgeCalls.find((call) => call.action === 'saveWelcomeSettings');
    assert.deepEqual(save.payload, { userId: USER_ID, settings: body });
    assert.equal(auditEntries[0].action, 'Updated welcome messages');
});

test('ticket saves and panel posts go to the shard as the session user and are recorded', async () => {
    saveChanges = ['Tickets: off → on'];
    const client = await login();

    assert.equal((await client.request(`/api/guilds/${GUILD_ID}/tickets`, json({ enabled: true }))).status, 200);
    const save = bridgeCalls.find((call) => call.action === 'saveTicketSettings');
    assert.deepEqual(save.payload, { userId: USER_ID, settings: { enabled: true } });
    assert.equal(auditEntries[0].action, 'Updated ticket settings');

    const panel = await client.request(
        `/api/guilds/${GUILD_ID}/tickets/panel`,
        json({ channelId: '1', userId: DEV_ID }, 'POST')
    );
    assert.equal(panel.status, 200);
    const post = bridgeCalls.find((call) => call.action === 'postTicketPanel');
    assert.deepEqual(post.payload, { userId: USER_ID, channelId: '1' });
});

test('moderation cases: only for server managers, with filters passed through as text', async () => {
    const client = await login();
    cases.push({ guildId: GUILD_ID, number: 7, action: 'warn', username: 'target', reason: 'spam' });

    const response = await client.request(`/api/guilds/${GUILD_ID}/cases?member=target&action=warn&before=9`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).cases[0].number, 7);
    assert.deepEqual(caseQueries[0], {
        guildId: GUILD_ID,
        filters: { member: 'target', action: 'warn', before: '9' },
    });
    assert.deepEqual(bridgeCalls.at(-1), { action: 'access', guildId: GUILD_ID, payload: { userId: USER_ID } });

    // Arrays from repeated query parameters are ignored, never passed on as objects
    await client.request(`/api/guilds/${GUILD_ID}/cases?member=a&member=b`);
    assert.equal(caseQueries[1].filters.member, undefined);

    denyAccess = true;
    assert.equal((await client.request(`/api/guilds/${GUILD_ID}/cases`)).status, 403);
    assert.equal(caseQueries.length, 2, 'the database is never read for someone without access');
});

test('deleting a case is recorded in the Web Logs, and odd case numbers never reach the database', async () => {
    const client = await login();
    cases.push({ guildId: GUILD_ID, number: 7, action: 'warn', username: 'target', reason: 'spam' });

    const response = await client.request(`/api/guilds/${GUILD_ID}/cases/7`, json({}, 'DELETE'));
    assert.equal(response.status, 200);
    assert.equal(cases.length, 0);
    assert.equal(auditEntries[0].action, 'Deleted a moderation case');
    assert.deepEqual(auditEntries[0].changes, ['Case #7: Warning for @target: spam']);

    assert.equal((await client.request(`/api/guilds/${GUILD_ID}/cases/7`, json({}, 'DELETE'))).status, 404);
    for (const bad of ['0', '-1', 'abc', '1e3', '99999999999']) {
        assert.equal(
            (await client.request(`/api/guilds/${GUILD_ID}/cases/${bad}`, json({}, 'DELETE'))).status,
            404,
            bad
        );
    }
    assert.equal(auditEntries.length, 1);

    denyAccess = true;
    cases.push({ guildId: GUILD_ID, number: 8, action: 'ban', username: 'x', reason: null });
    assert.equal((await client.request(`/api/guilds/${GUILD_ID}/cases/8`, json({}, 'DELETE'))).status, 403);
    assert.equal(cases.length, 1, 'not deleted without access');
});

test('saving automatic moderation is recorded in the Web Logs', async () => {
    saveChanges = ['At 3 warnings: added kick'];
    const client = await login();
    const response = await client.request(`/api/guilds/${GUILD_ID}/moderation`, json({ warnActions: [] }));
    assert.equal(response.status, 200);
    assert.equal(bridgeCalls.at(-1).action, 'saveModerationSettings');
    assert.equal(auditEntries[0].action, 'Updated automatic moderation');

    assert.equal((await client.request(`/api/guilds/${GUILD_ID}/reset/moderation`, json({}, 'POST'))).status, 200);
    assert.equal(auditEntries[1].action, 'Reset automatic moderation');
});

test('test logs go to the shard as the session user', async () => {
    const client = await login();
    const response = await client.request(`/api/guilds/${GUILD_ID}/logging/test`, json({}, 'POST'));
    assert.equal(response.status, 200);
    assert.deepEqual(bridgeCalls.at(-1), { action: 'testLogs', guildId: GUILD_ID, payload: { userId: USER_ID } });
    assert.equal(auditEntries.length, 0, 'a test is not a settings change');
});

test('stream routes go to the shard as the session user, and odd IDs never reach it', async () => {
    saveChanges = ['Followed Twitch shroud in #streams'];
    const client = await login();
    const id = 'a'.repeat(24);

    assert.equal(
        (await client.request(`/api/guilds/${GUILD_ID}/streams`, json({ platform: 'twitch' }, 'POST'))).status,
        200
    );
    assert.equal(auditEntries[0].action, 'Updated stream notifications');
    assert.equal((await client.request(`/api/guilds/${GUILD_ID}/streams/twitch`, json([]))).status, 200);
    assert.equal((await client.request(`/api/guilds/${GUILD_ID}/streams/facebook`, json([]))).status, 404);
    assert.equal((await client.request(`/api/guilds/${GUILD_ID}/streams/${id}`, json({}, 'DELETE'))).status, 200);
    assert.equal((await client.request(`/api/guilds/${GUILD_ID}/streams/not-an-id`, json({}, 'DELETE'))).status, 404);
    assert.equal((await client.request(`/api/guilds/${GUILD_ID}/streams/${id}/test`, json({}, 'POST'))).status, 200);

    const actions = bridgeCalls.map((call) => call.action);
    for (const action of ['addStream', 'saveStreams', 'removeStream', 'testStream'])
        assert.ok(actions.includes(action), action);
    assert.ok(bridgeCalls.every((call) => !call.payload.userId || call.payload.userId === USER_ID));
});

test('only Bot Settings saves may be large (for images); other requests stay small', async () => {
    const client = await login();
    const big = { nickname: 'x', avatar: 'a'.repeat(100_000) };

    const profile = await client.request(`/api/guilds/${GUILD_ID}/bot`, json(big));
    assert.equal(profile.status, 200, 'the shard validates the image itself');

    const levels = await client.request(`/api/guilds/${GUILD_ID}/levels`, json(big));
    assert.equal(levels.status, 413);
});

test('a failing Web Logs store does not fail the save', async () => {
    const client = await login();
    const original = auditStore.record;
    auditStore.record = async () => {
        throw new Error('db down');
    };
    try {
        const response = await client.request(`/api/guilds/${GUILD_ID}/levels`, json({ maxLevel: 10 }));
        assert.equal(response.status, 200);
    } finally {
        auditStore.record = original;
    }
});

test('reading the Web Logs needs Manage Server, checked live on the shard', async () => {
    const client = await login();
    denyAccess = true;
    const denied = await client.request(`/api/guilds/${GUILD_ID}/audit-log`);
    assert.equal(denied.status, 403);
    assert.equal(auditQueries.length, 0, 'the database is never queried without access');

    denyAccess = false;
    const allowed = await client.request(`/api/guilds/${GUILD_ID}/audit-log?username=dex&action=max&before=abc`);
    assert.equal(allowed.status, 200);
    assert.deepEqual(auditQueries[0], {
        guildId: GUILD_ID,
        filters: { username: 'dex', action: 'max', before: 'abc' },
    });
    assert.equal(bridgeCalls.find((call) => call.action === 'access').payload.userId, USER_ID);
});

test('Web Logs filters ignore non-string query values', async () => {
    const client = await login();
    await client.request(`/api/guilds/${GUILD_ID}/audit-log?username=a&username=b`);
    assert.deepEqual(auditQueries[0].filters, { username: undefined, action: undefined, before: undefined });
});

test('Web Logs need login', async () => {
    assert.equal((await browser().request(`/api/guilds/${GUILD_ID}/audit-log`)).status, 401);
});
