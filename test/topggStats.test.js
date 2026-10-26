import './helpers/setupEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postTopggStats } from '../src/features/votes/utils/topggStats.js';

const APPLICATION_ID = '100000000000000000';

/** @param {number[] | Error} counts */
const fakeManager = (counts, totalShards = 2) => ({
    totalShards,
    fetchClientValues: async () => {
        if (counts instanceof Error) throw counts;
        return counts;
    },
});

test('the server count from every shard is posted to Top.gg with the token', async () => {
    const requests = [];
    const fetchImpl = async (url, init) => {
        requests.push({ url, init });
        return new Response('{}', { status: 200 });
    };

    const sent = await postTopggStats({
        manager: /** @type {any} */ (fakeManager([120, 80])),
        token: 'topgg-token',
        applicationId: APPLICATION_ID,
        fetchImpl: /** @type {any} */ (fetchImpl),
    });

    assert.equal(sent, 200);
    const [{ url, init }] = requests;
    assert.equal(url, `https://top.gg/api/bots/${APPLICATION_ID}/stats`);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'topgg-token');
    assert.deepEqual(JSON.parse(init.body), { server_count: 200, shard_count: 2 });
});

test('nothing is posted while shards are still starting', async () => {
    let called = false;
    const sent = await postTopggStats({
        manager: /** @type {any} */ (fakeManager(new Error('Shards are still being spawned'))),
        token: 'topgg-token',
        applicationId: APPLICATION_ID,
        fetchImpl: /** @type {any} */ (async () => ((called = true), new Response('{}'))),
    });
    assert.equal(sent, null);
    assert.equal(called, false);
});

test('a rejected token or a network error is logged, never thrown', async () => {
    const options = { manager: /** @type {any} */ (fakeManager([5])), token: 'bad', applicationId: APPLICATION_ID };
    assert.equal(
        await postTopggStats({
            ...options,
            fetchImpl: /** @type {any} */ (async () => new Response('', { status: 401 })),
        }),
        null
    );
    assert.equal(
        await postTopggStats({
            ...options,
            fetchImpl: /** @type {any} */ (
                async () => {
                    throw new Error('getaddrinfo ENOTFOUND top.gg');
                }
            ),
        }),
        null
    );
});

test('/vote shows when someone can vote again, and their total', async () => {
    const { voteStatus } = await import('../src/features/votes/commands/vote.js');
    const now = Date.UTC(2026, 9, 12, 12);
    const hour = 60 * 60 * 1000;

    assert.deepEqual(voteStatus(null, now), [{ key: 'can_vote', vars: {} }]);
    assert.deepEqual(voteStatus({ votes: 4, lastVotedAt: new Date(now - 2 * hour) }, now), [
        { key: 'voted_recently', vars: { next: `<t:${(now + 10 * hour) / 1000}:R>` } },
        { key: 'total', vars: { count: 4 } },
    ]);
    assert.equal(voteStatus({ votes: 4, lastVotedAt: new Date(now - 13 * hour) }, now)[0].key, 'can_vote_again');
});

test('voters get 10% more XP for 12 hours, and a new vote counts straight away', async () => {
    const { ENV } = await import('../src/bootstrap/environment.js');
    const { UserVote } = await import('../src/features/votes/models/userVote.js');
    const { voteXPMultiplier, forgetVote } = await import('../src/features/votes/utils/votes.js');
    const userId = '300000000000000099';
    const now = Date.UTC(2026, 9, 12, 12);
    const hour = 60 * 60 * 1000;
    let lastVotedAt = null;
    let lookups = 0;
    UserVote.findOne = /** @type {any} */ (() => ({ lean: async () => (lookups++, lastVotedAt && { lastVotedAt }) }));

    const savedSecret = ENV.TOPGG_WEBHOOK_SECRET;
    const savedDashboard = ENV.DASHBOARD;
    try {
        ENV.TOPGG_WEBHOOK_SECRET = null;
        assert.equal(await voteXPMultiplier(userId, now), 1, 'no bonus without votes set up');
        assert.equal(lookups, 0);

        ENV.TOPGG_WEBHOOK_SECRET = 'secret';
        ENV.DASHBOARD = /** @type {any} */ (savedDashboard ?? {});
        assert.equal(await voteXPMultiplier(userId, now), 1);

        lastVotedAt = new Date(now - hour);
        assert.equal(await voteXPMultiplier(userId, now), 1, 'cached until told about the vote');
        forgetVote(userId);
        assert.equal(await voteXPMultiplier(userId, now), 1.1);
        assert.equal(await voteXPMultiplier(userId, now + 12 * hour), 1, 'ends after 12 hours');
        assert.equal(lookups, 2, 'looked up once, then once more after the vote');
    } finally {
        ENV.TOPGG_WEBHOOK_SECRET = savedSecret;
        ENV.DASHBOARD = savedDashboard;
        forgetVote(userId);
    }
});

test('vote reminders: one DM per vote once its 12 hours are up, and closed DMs turn them off', async () => {
    const { UserVote } = await import('../src/features/votes/models/userVote.js');
    const { toggleReminders, sendDueReminders, reminderMessage } =
        await import('../src/features/votes/utils/reminders.js');
    const hour = 60 * 60 * 1000;
    const now = new Date(Date.UTC(2026, 9, 12, 12));
    /** @type {Map<string, any>} */
    const docs = new Map();
    const isDue = (doc) =>
        doc.remind &&
        doc.lastVotedAt &&
        doc.lastVotedAt.getTime() <= now.getTime() - 12 * hour &&
        (!doc.remindedAt || doc.remindedAt < doc.lastVotedAt);

    UserVote.findOne = /** @type {any} */ (({ userId }) => ({ lean: async () => docs.get(userId) ?? null }));
    UserVote.find = /** @type {any} */ (
        () => ({ limit: () => ({ lean: async () => [...docs.values()].filter(isDue) }) })
    );
    UserVote.updateOne = /** @type {any} */ (
        async (filter, { $set }) => {
            const doc = docs.get(filter.userId) ?? {
                userId: filter.userId,
                remind: false,
                lastVotedAt: null,
                remindedAt: null,
            };
            // The claim only succeeds while the reminder is still unsent
            if (filter.$or && !isDue(doc)) return { modifiedCount: 0 };
            docs.set(filter.userId, { ...doc, ...$set });
            return { modifiedCount: 1 };
        }
    );

    // Voted 2 hours ago, then turned reminders on: reminded when the 12 hours are up
    docs.set('voter', {
        userId: 'voter',
        remind: false,
        lastVotedAt: new Date(now.getTime() - 14 * hour),
        remindedAt: null,
    });
    docs.set('closed', {
        userId: 'closed',
        remind: true,
        lastVotedAt: new Date(now.getTime() - 13 * hour),
        remindedAt: null,
    });
    assert.equal(await toggleReminders('voter', new Date(now.getTime() - 12 * hour)), true);

    const dms = [];
    const client = /** @type {any} */ ({
        users: {
            fetch: async (id) => ({
                send: async (message) => {
                    if (id === 'closed') throw new Error('Cannot send messages to this user');
                    dms.push({ id, message });
                },
            }),
        },
    });

    assert.equal(await sendDueReminders(client, now), 1);
    assert.deepEqual(
        dms.map((dm) => dm.id),
        ['voter']
    );
    assert.equal(docs.get('closed').remind, false, 'closed DMs turn reminders off');

    assert.equal(await sendDueReminders(client, now), 0, 'never twice for the same vote');
    assert.equal(await toggleReminders('voter', now), false);
    assert.equal(reminderMessage('en-GB').components[0].components[1].data.custom_id, 'vote:remind');
});
