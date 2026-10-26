import './helpers/setupEnv.js';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardApp } from '../src/dashboard/server.js';
import { createHmac } from 'node:crypto';
import { isAuthorized, isValidSignature } from '../src/features/votes/utils/webhook.js';
import { UserVote } from '../src/features/votes/models/userVote.js';

const SECRET = 'a-long-random-top-gg-secret';
const APPLICATION_ID = '100000000000000000';
const VOTER = '300000000000000001';

let server;
let base;
let recorded;
let logged;
let failRecording;

const bridge = {
    async guild() {
        return { ok: true, data: {} };
    },
    async botGuildIds() {
        return new Set();
    },
    async stats() {
        return [];
    },
    async logVote(userId, votes) {
        logged.push({ userId, votes });
    },
};

before(async () => {
    const app = createDashboardApp({
        bridge,
        env: /** @type {any} */ ({
            APPLICATION_ID,
            DEVELOPER_IDS: [],
            TOPGG_WEBHOOK_SECRET: SECRET,
            DASHBOARD: {
                PORT: 0,
                HOST: '127.0.0.1',
                URL: 'http://localhost:3000',
                SECURE: false,
                TRUST_PROXY: false,
                CLIENT_SECRET: 'client-secret',
                SESSION_SECRET: 'test-session-secret-that-is-long-enough',
            },
        }),
        auditStore: /** @type {any} */ ({ record: async () => {}, list: async () => ({ entries: [] }) }),
        caseStore: /** @type {any} */ ({ list: async () => ({ cases: [] }), remove: async () => null }),
    });
    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

beforeEach(() => {
    recorded = [];
    logged = [];
    failRecording = false;
    UserVote.findOneAndUpdate = /** @type {any} */ (
        (filter) => ({
            lean: async () => {
                if (failRecording) throw new Error('database down');
                recorded.push(filter.userId);
                return { userId: filter.userId, votes: recorded.length };
            },
        })
    );
});

/** Top.gg's servers post straight to the webhook: no Origin header, no session. */
const vote = (body, authorization = SECRET) =>
    fetch(`${base}/webhooks/topgg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
        body: JSON.stringify(body),
    });

test('the secret is compared exactly', () => {
    assert.equal(isAuthorized(SECRET, SECRET), true);
    assert.equal(isAuthorized(`${SECRET} `, SECRET), false);
    assert.equal(isAuthorized('', SECRET), false);
    assert.equal(isAuthorized(undefined, SECRET), false);
    assert.equal(isAuthorized(SECRET, ''), false);
});

test('a vote from Top.gg is recorded and logged', async () => {
    const response = await vote({ bot: APPLICATION_ID, user: VOTER, type: 'upvote' });
    assert.equal(response.status, 200);
    assert.deepEqual(recorded, [VOTER]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(logged, [{ userId: VOTER, votes: 1 }]);
});

test('requests without the right secret are refused and nothing is recorded', async () => {
    assert.equal((await vote({ user: VOTER, type: 'upvote' }, 'wrong')).status, 401);
    assert.equal((await vote({ user: VOTER, type: 'upvote' }, null)).status, 401);
    assert.deepEqual(recorded, []);
});

test("Top.gg's test button checks the webhook without counting a vote", async () => {
    const response = await vote({ bot: APPLICATION_ID, user: VOTER, type: 'test' });
    assert.equal(response.status, 200);
    assert.deepEqual(recorded, []);
});

test('votes for another bot, or without a valid user, are refused', async () => {
    assert.equal((await vote({ bot: '999999999999999999', user: VOTER, type: 'upvote' })).status, 400);
    assert.equal((await vote({ bot: APPLICATION_ID, user: 'someone', type: 'upvote' })).status, 400);
    assert.deepEqual(recorded, []);
});

test('if the vote cannot be saved, Top.gg is told to retry', async () => {
    failRecording = true;
    assert.equal((await vote({ bot: APPLICATION_ID, user: VOTER, type: 'upvote' })).status, 500);
});

// ---------- Top.gg's current (v1) webhooks: signed instead of a shared Authorization ----------

const sign = (rawBody, { secret = SECRET, at = Date.now() } = {}) => {
    const t = Math.floor(at / 1000);
    return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')}`;
};

/** Posts exactly this body, signed (or with the given signature header). */
const signedVote = (body, signature) => {
    const raw = JSON.stringify(body);
    return fetch(`${base}/webhooks/topgg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-topgg-signature': signature ?? sign(raw) },
        body: raw,
    });
};

const v1Vote = (id = 'vote-1', user = VOTER, bot = APPLICATION_ID) => ({
    type: 'vote.create',
    data: {
        id,
        weight: 1,
        project: { id: 'p1', type: 'bot', platform: 'discord', platform_id: bot },
        user: { id: 'u1', platform_id: user, name: 'voter', avatar_url: null },
    },
});

test('signatures are checked against the exact body, the secret and the time', () => {
    const raw = '{"a":1}';
    assert.equal(isValidSignature(sign(raw), raw, SECRET), true);
    assert.equal(isValidSignature(sign(raw), '{"a":2}', SECRET), false, 'body changed');
    assert.equal(isValidSignature(sign(raw, { secret: 'other' }), raw, SECRET), false);
    assert.equal(isValidSignature(sign(raw, { at: Date.now() - 2 * 3_600_000 }), raw, SECRET), false, 'too old');
    assert.equal(isValidSignature('nonsense', raw, SECRET), false);
    assert.equal(isValidSignature(undefined, raw, SECRET), false);
});

test('a signed vote is recorded once, even if Top.gg delivers it again', async () => {
    assert.equal((await signedVote(v1Vote('vote-a'))).status, 200);
    assert.equal((await signedVote(v1Vote('vote-a'))).status, 200);
    assert.deepEqual(recorded, [VOTER]);
});

test('a badly signed request is refused', async () => {
    assert.equal((await signedVote(v1Vote('vote-b'), sign('{}'))).status, 401);
    assert.equal((await signedVote(v1Vote('vote-b'), 't=1,v1=abc')).status, 401);
    assert.deepEqual(recorded, []);
});

test("signed: Top.gg's test, other bots, and events Ovx doesn't use", async () => {
    const test = { type: 'webhook.test', data: v1Vote().data };
    assert.equal((await signedVote(test)).status, 200);
    assert.equal((await signedVote(v1Vote('vote-c', VOTER, '999999999999999999'))).status, 400);
    assert.equal((await signedVote({ type: 'something.else', data: {} })).status, 200);
    assert.deepEqual(recorded, []);
});
