import './helpers/setupEnv.js';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { ENV } from '../src/bootstrap/environment.js';
import { Giveaway, GiveawayEntry, GiveawayConfig } from '../src/features/giveaways/models/giveaway.js';
import { UserVote } from '../src/features/votes/models/userVote.js';
import { validateGiveaway, GIVEAWAY_LIMITS } from '../src/features/giveaways/utils/validation.js';
import {
    pickWinners,
    createGiveaway,
    endGiveaway,
    rerollGiveaway,
    cancelGiveaway,
    deleteGiveaway,
} from '../src/features/giveaways/utils/lifecycle.js';
import { enterGiveaway, leaveGiveaway, canManageGiveaways } from '../src/features/giveaways/utils/entry.js';
import { giveawayDashboard } from '../src/features/giveaways/utils/dashboard.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';
import User_Levels_Cache from '../src/features/levels/cache/userLevels.cache.js';

const GUILD = '400000000000000001';
const CHANNEL = '500000000000000001';
const ROLE = '600000000000000001';
const HOST = '100000000000000001';
const NOW = new Date('2026-10-12T12:00:00Z');

// ---------- In-memory Giveaway and GiveawayEntry ----------

let giveaways;
let entries;
let nextId;

const matches = (doc, filter) =>
    Object.entries(filter).every(([key, value]) =>
        value && typeof value === 'object' && '$in' in value
            ? value.$in.map(String).includes(String(doc[key]))
            : String(doc[key]) === String(value)
    );

const apply = (doc, update) => {
    Object.assign(doc, update.$set ?? {});
    for (const [key, amount] of Object.entries(update.$inc ?? {})) doc[key] = (doc[key] ?? 0) + amount;
    for (const [key, { $each }] of Object.entries(update.$push ?? {})) doc[key] = [...doc[key], ...$each];
    return doc;
};

const lean = (value) => ({ lean: async () => (value ? structuredClone(value) : null) });

beforeEach(() => {
    giveaways = [];
    entries = [];
    nextId = 1;

    Giveaway.create = /** @type {any} */ (
        async (doc) => {
            const created = {
                _id: String(nextId++).padStart(24, '0'),
                messageId: null,
                description: null,
                winners: [],
                entrantCount: 0,
                endedAt: null,
                createdAt: NOW,
                ...doc,
            };
            giveaways.push(created);
            return { toObject: () => structuredClone(created) };
        }
    );
    Giveaway.countDocuments = /** @type {any} */ (async (filter) => giveaways.filter((g) => matches(g, filter)).length);
    Giveaway.findOne = /** @type {any} */ ((filter) => lean(giveaways.find((g) => matches(g, filter))));
    Giveaway.findById = /** @type {any} */ ((id) => lean(giveaways.find((g) => g._id === String(id))));
    Giveaway.findOneAndUpdate = /** @type {any} */ (
        (filter, update) => {
            const doc = giveaways.find((g) => matches(g, filter));
            return lean(doc ? apply(doc, update) : null);
        }
    );
    Giveaway.findByIdAndUpdate = /** @type {any} */ (
        (id, update) => {
            const doc = giveaways.find((g) => g._id === String(id));
            return lean(doc ? apply(doc, update) : null);
        }
    );
    Giveaway.updateOne = /** @type {any} */ (
        async (filter, update) => {
            const doc = giveaways.find((g) => matches(g, filter));
            if (doc) apply(doc, update);
        }
    );
    Giveaway.deleteOne = /** @type {any} */ (
        async (filter) => (giveaways = giveaways.filter((g) => !matches(g, filter)))
    );
    Giveaway.findOneAndDelete = /** @type {any} */ (
        (filter) => {
            const doc = giveaways.find((g) => matches(g, filter));
            if (doc) giveaways = giveaways.filter((g) => g !== doc);
            return lean(doc);
        }
    );

    GiveawayEntry.find = /** @type {any} */ ((filter) => lean(entries.filter((e) => matches(e, filter))));
    GiveawayEntry.findOne = /** @type {any} */ ((filter) => lean(entries.find((e) => matches(e, filter))));
    GiveawayEntry.create = /** @type {any} */ (
        async (doc) => {
            if (entries.some((e) => String(e.giveawayId) === String(doc.giveawayId) && e.userId === doc.userId)) {
                throw Object.assign(new Error('duplicate key'), { code: 11000 });
            }
            entries.push({ _id: `e${entries.length}`, ...doc });
        }
    );
    GiveawayEntry.updateOne = /** @type {any} */ (
        async (filter, update) => {
            const doc = entries.find((e) => matches(e, filter));
            if (doc) apply(doc, update);
        }
    );
    GiveawayEntry.deleteOne = /** @type {any} */ (
        async (filter) => {
            const before = entries.length;
            entries = entries.filter((e) => !matches(e, filter));
            return { deletedCount: before - entries.length };
        }
    );
    GiveawayEntry.deleteMany = /** @type {any} */ (
        async (filter) => (entries = entries.filter((e) => !matches(e, filter)))
    );

    Guild_Settings_Cache.get = /** @type {any} */ (async () => ({ embedColour: null, premiumUntil: null }));
    User_Levels_Cache.get = /** @type {any} */ (async (guildId, userId) => ({ level: userId === 'high' ? 50 : 2 }));
    GiveawayConfig.findOne = /** @type {any} */ (() => lean({ managerRoleIds: [ROLE] }));
    UserVote.findOne = /** @type {any} */ (() => lean(null));
});

afterEach(() => {
    ENV.TOPGG_WEBHOOK_SECRET = null;
});

// ---------- A fake guild ----------

function fakeGuild({ members = [] } = {}) {
    const sent = [];
    const edits = [];
    const dms = [];
    const channel = {
        id: CHANNEL,
        name: 'giveaways',
        isTextBased: () => true,
        permissionsFor: () => ({ has: () => true }),
        send: async (message) => {
            sent.push(message);
            return { id: `7000000000000000${String(sent.length).padStart(2, '0')}` };
        },
        messages: { fetch: async () => ({ edit: async (message) => edits.push(message) }) },
    };
    const memberMap = new Map(
        members.map((m) => [m.id, { id: m.id, roles: { cache: new Map((m.roles ?? []).map((r) => [r, {}])) } }])
    );
    const guild = {
        id: GUILD,
        name: 'Test Server',
        preferredLocale: 'en-GB',
        channels: { cache: new Map([[CHANNEL, channel]]) },
        roles: { cache: new Map([[ROLE, { name: 'VIP' }]]) },
        members: {
            me: {},
            fetch: async (id) => {
                if (!memberMap.has(id)) throw new Error('Unknown Member');
                return memberMap.get(id);
            },
        },
        client: {
            users: {
                cache: new Map(),
                fetch: async (id) => ({ id, send: async (message) => dms.push({ id, message }) }),
            },
        },
    };
    return { guild: /** @type {any} */ (guild), sent, edits, dms };
}

const context = { textChannelIds: new Set([CHANNEL]), roleIds: new Set([ROLE]) };

/** A running giveaway, created through the real code. */
async function startGiveaway(guild, overrides = {}) {
    const { giveaway } = validateGiveaway(
        { prize: 'Nitro', channelId: CHANNEL, winnerCount: 1, duration: '1d', ...overrides },
        context,
        NOW
    );
    const result = await createGiveaway(guild, giveaway, { hostId: HOST, createdBy: HOST });
    assert.ok(result.ok, result.reason);
    return result.giveaway;
}

// ---------- Drawing ----------

test('winners are drawn by entries, and nobody wins twice', () => {
    const pool = [
        { userId: 'a', entries: 1 },
        { userId: 'b', entries: 3 },
        { userId: 'c', entries: 1 },
    ];
    // Tickets: a=0, b=1..3, c=4
    assert.deepEqual(
        pickWinners(pool, 1, () => 0),
        ['a']
    );
    assert.deepEqual(
        pickWinners(pool, 1, () => 3),
        ['b']
    );
    assert.deepEqual(
        pickWinners(pool, 1, () => 4),
        ['c']
    );
    assert.deepEqual(
        pickWinners(pool, 3, () => 0),
        ['a', 'b', 'c']
    );
    assert.deepEqual(pickWinners(pool, 10, () => 0).length, 3);
    assert.deepEqual(pickWinners([], 2), []);
});

test('with real random numbers, more entries win more often', () => {
    const wins = { one: 0, three: 0 };
    for (let i = 0; i < 4000; i++) {
        const [winner] = pickWinners(
            [
                { userId: 'one', entries: 1 },
                { userId: 'three', entries: 3 },
            ],
            1
        );
        wins[winner]++;
    }
    // Expected 1000 and 3000; allow plenty of room for chance
    assert.ok(wins.three > 2600 && wins.three < 3400, JSON.stringify(wins));
});

// ---------- Validation ----------

test('a giveaway starts now, or is scheduled for later', () => {
    const now = validateGiveaway({ prize: ' Nitro ', channelId: CHANNEL, duration: '2h' }, context, NOW);
    assert.deepEqual(now.errors, []);
    assert.equal(now.giveaway.prize, 'Nitro');
    assert.equal(now.giveaway.status, 'running');
    assert.equal(now.giveaway.endsAt.getTime() - NOW.getTime(), 2 * 60 * 60 * 1000);

    const later = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const scheduled = validateGiveaway(
        { prize: 'Nitro', channelId: CHANNEL, duration: '1h', startsAt: later.toISOString() },
        context,
        NOW
    );
    assert.equal(scheduled.giveaway.status, 'scheduled');
    assert.equal(scheduled.giveaway.endsAt.getTime() - later.getTime(), 60 * 60 * 1000);
});

test('bad giveaway details are all reported', () => {
    const { giveaway, errors } = validateGiveaway(
        {
            prize: '',
            channelId: '999',
            winnerCount: 0,
            duration: 'soon',
            startsAt: '2020-01-01T00:00:00Z',
            roleIds: ['nope'],
            minLevel: -1,
            voteBonus: GIVEAWAY_LIMITS.VOTE_BONUS_MAX + 1,
        },
        context,
        NOW
    );
    assert.equal(giveaway, null);
    assert.equal(errors.length, 8);
    assert.match(
        validateGiveaway({ prize: 'x', channelId: CHANNEL, duration: '10s' }, context, NOW).errors[0],
        /between 1 minute and/
    );
});

// ---------- Lifecycle ----------

test('ending draws from the entrants still in the server, announces and DMs the winners', async () => {
    const { guild, sent, edits, dms } = fakeGuild({ members: [{ id: 'stays' }] });
    const giveaway = await startGiveaway(guild, { winnerCount: 2 });
    assert.equal(sent.length, 1, 'the giveaway message was posted');
    entries.push(
        { giveawayId: giveaway._id, userId: 'left', entries: 1 },
        { giveawayId: giveaway._id, userId: 'stays', entries: 1 }
    );

    const result = await endGiveaway(guild, String(giveaway._id), NOW);

    assert.ok(result.ok);
    assert.deepEqual(result.winners, ['stays']);
    assert.equal(giveaways[0].status, 'ended');
    assert.equal(edits.length, 1, 'the message was updated');
    const announcement = sent[1];
    assert.match(announcement.content, /<@stays>.*Nitro/);
    assert.deepEqual(announcement.allowedMentions.users, ['stays'], 'only winners are pinged');
    assert.deepEqual(
        dms.map((dm) => dm.id),
        ['stays']
    );
});

test('a giveaway is only ended once, even if the timer and a command race', async () => {
    const { guild } = fakeGuild();
    const giveaway = await startGiveaway(guild);
    const [first, second] = await Promise.all([
        endGiveaway(guild, String(giveaway._id), NOW),
        endGiveaway(guild, String(giveaway._id), NOW),
    ]);
    assert.deepEqual([first.ok, second.ok].sort(), [false, true]);
});

test('with a required role, winners must still have it when drawn', async () => {
    const { guild } = fakeGuild({ members: [{ id: 'lost-role' }, { id: 'has-role', roles: [ROLE] }] });
    const giveaway = await startGiveaway(guild, { roleIds: [ROLE] });
    entries.push(
        { giveawayId: giveaway._id, userId: 'lost-role', entries: 5 },
        { giveawayId: giveaway._id, userId: 'has-role', entries: 1 }
    );
    const result = await endGiveaway(guild, String(giveaway._id), NOW);
    assert.deepEqual(result.winners, ['has-role']);
});

test('nobody entering ends with no winners and says so', async () => {
    const { guild, sent, dms } = fakeGuild();
    const giveaway = await startGiveaway(guild);
    const result = await endGiveaway(guild, String(giveaway._id), NOW);
    assert.deepEqual(result.winners, []);
    assert.match(sent[1].content, /nobody could win/);
    assert.equal(dms.length, 0);
});

test('a reroll draws someone who has not won yet, until nobody is left', async () => {
    const { guild } = fakeGuild({ members: [{ id: 'a' }, { id: 'b' }] });
    const giveaway = await startGiveaway(guild);
    entries.push(
        { giveawayId: giveaway._id, userId: 'a', entries: 1 },
        { giveawayId: giveaway._id, userId: 'b', entries: 1 }
    );
    const ended = await endGiveaway(guild, String(giveaway._id), NOW);

    const reroll = await rerollGiveaway(guild, String(giveaway._id));
    assert.ok(reroll.ok);
    assert.notEqual(reroll.winners[0], ended.winners[0]);
    assert.equal(giveaways[0].winners.length, 2);

    assert.deepEqual(await rerollGiveaway(guild, String(giveaway._id)), { ok: false, reason: 'no_entrants_left' });
});

test('running giveaways cannot be rerolled or deleted, and cancelled ones cannot be ended', async () => {
    const { guild } = fakeGuild();
    const giveaway = await startGiveaway(guild);
    const id = String(giveaway._id);
    assert.equal((await rerollGiveaway(guild, id)).reason, 'not_ended');
    assert.equal((await deleteGiveaway(GUILD, id)).reason, 'not_deletable');

    assert.ok((await cancelGiveaway(guild, id)).ok);
    assert.equal((await endGiveaway(guild, id)).reason, 'not_running');
    assert.ok((await deleteGiveaway(GUILD, id)).ok);
    assert.equal(giveaways.length, 0);
});

test('a server can only have so many giveaways at once', async () => {
    const { guild } = fakeGuild();
    for (let i = 0; i < GIVEAWAY_LIMITS.ACTIVE_MAX; i++) await startGiveaway(guild);
    const { giveaway } = validateGiveaway({ prize: 'One more', channelId: CHANNEL, duration: '1d' }, context, NOW);
    assert.deepEqual(await createGiveaway(guild, giveaway, { hostId: HOST, createdBy: HOST }), {
        ok: false,
        reason: 'too_many',
    });
});

test('a scheduled giveaway is saved but not posted yet', async () => {
    const { guild, sent } = fakeGuild();
    const { giveaway } = validateGiveaway(
        {
            prize: 'Later',
            channelId: CHANNEL,
            duration: '1d',
            startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
        context
    );
    const result = await createGiveaway(guild, giveaway, { hostId: HOST, createdBy: HOST });
    assert.equal(result.giveaway.status, 'scheduled');
    assert.equal(sent.length, 0);
});

// ---------- Entering ----------

/** A fake click on a giveaway button. */
function click(guild, { userId = 'member', roles = [] } = {}) {
    const replies = [];
    const interaction = {
        guild,
        guildId: GUILD,
        locale: 'en-GB',
        user: { id: userId },
        member: { id: userId, guild, roles: { cache: new Map(roles.map((r) => [r, {}])) } },
        client: { utils: { Translate: (key, locale, vars) => `${key}${vars ? ` ${JSON.stringify(vars)}` : ''}` } },
        reply: async (message) => replies.push(message),
        update: async (message) => replies.push(message),
    };
    return { interaction: /** @type {any} */ (interaction), replies };
}

test('entering adds one entry, and clicking again does not add another', async () => {
    const { guild } = fakeGuild();
    const giveaway = await startGiveaway(guild);
    const id = String(giveaway._id);

    const first = click(guild);
    await enterGiveaway(first.interaction, id);
    assert.match(first.replies[0].content, /giveaways\.entry\.entered$/);

    const second = click(guild);
    await enterGiveaway(second.interaction, id);
    assert.match(second.replies[0].content, /already/);
    assert.equal(entries.length, 1);
    assert.equal(giveaways[0].entrantCount, 1);
});

test('the role and level requirements are checked when entering', async () => {
    const { guild } = fakeGuild();
    const id = String((await startGiveaway(guild, { roleIds: [ROLE], minLevel: 10 }))._id);

    const noRole = click(guild, { userId: 'high' });
    await enterGiveaway(noRole.interaction, id);
    assert.match(noRole.replies[0].content, /missing_role/);

    const lowLevel = click(guild, { userId: 'low', roles: [ROLE] });
    await enterGiveaway(lowLevel.interaction, id);
    assert.match(lowLevel.replies[0].content, /low_level/);

    const allowed = click(guild, { userId: 'high', roles: [ROLE] });
    await enterGiveaway(allowed.interaction, id);
    assert.match(allowed.replies[0].content, /entered$/);
    assert.equal(entries.length, 1);
});

test('voting on Top.gg gives bonus entries, also when voting after entering', async () => {
    ENV.TOPGG_WEBHOOK_SECRET = 'secret';
    const { guild } = fakeGuild();
    const id = String((await startGiveaway(guild, { voteBonus: 2 }))._id);

    const before = click(guild);
    await enterGiveaway(before.interaction, id);
    assert.equal(entries[0].entries, 1);
    assert.ok(before.replies[0].components[0].components.some((button) => button.data.url?.includes('top.gg')));

    UserVote.findOne = /** @type {any} */ (() => lean({ lastVotedAt: new Date(Date.now() - 60_000) }));
    const after = click(guild);
    await enterGiveaway(after.interaction, id);
    assert.match(after.replies[0].content, /bonus_added/);
    assert.equal(entries[0].entries, 3);
});

test('a vote older than 12 hours gives no bonus', async () => {
    ENV.TOPGG_WEBHOOK_SECRET = 'secret';
    UserVote.findOne = /** @type {any} */ (() => lean({ lastVotedAt: new Date(Date.now() - 13 * 3_600_000) }));
    const { guild } = fakeGuild();
    const id = String((await startGiveaway(guild, { voteBonus: 2 }))._id);
    await enterGiveaway(click(guild).interaction, id);
    assert.equal(entries[0].entries, 1);
});

test('leaving removes the entry, and ended giveaways cannot be entered', async () => {
    const { guild } = fakeGuild();
    const id = String((await startGiveaway(guild))._id);
    await enterGiveaway(click(guild).interaction, id);

    const leave = click(guild);
    await leaveGiveaway(leave.interaction, id);
    assert.equal(entries.length, 0);
    assert.equal(giveaways[0].entrantCount, 0);

    await endGiveaway(guild, id, NOW);
    const late = click(guild);
    await enterGiveaway(late.interaction, id);
    assert.match(late.replies[0].content, /closed/);
    await enterGiveaway(late.interaction, 'not-an-id');
    assert.match(late.replies[1].content, /closed/);
});

test('Manage Server or a giveaway manager role can run giveaways', async () => {
    const member = (permissions, roles = []) =>
        /** @type {any} */ ({
            guild: { id: GUILD },
            permissions: { has: (flag) => flag === PermissionFlagsBits.ManageGuild && permissions },
            roles: { cache: new Map(roles.map((r) => [r, {}])) },
        });
    assert.equal(await canManageGiveaways(member(true)), true);
    assert.equal(await canManageGiveaways(member(false, [ROLE])), true);
    assert.equal(await canManageGiveaways(member(false, ['other'])), false);
});

// ---------- Dashboard ----------

test('the dashboard starts giveaways with the user as host, and describes it for the Web Logs', async () => {
    const { guild } = fakeGuild();
    const result = await giveawayDashboard(
        guild,
        /** @type {any} */ ({ id: HOST }),
        { op: 'create', giveaway: { prize: 'Nitro', channelId: CHANNEL, winnerCount: 2, duration: '1d' } },
        context
    );
    assert.ok(result.ok);
    assert.equal(result.action, 'Started a giveaway');
    assert.deepEqual(result.changes, ['"Nitro" in #giveaways: 2 winners, runs 1 day']);
    assert.equal(giveaways[0].hostId, HOST);
    assert.equal(result.data.status, 'running');

    const bad = await giveawayDashboard(
        guild,
        /** @type {any} */ ({ id: HOST }),
        { op: 'end', giveawayId: '../x' },
        context
    );
    assert.equal(bad.ok, false);
});

// ---------- Giveaways from the old Ovx bot ----------

test('old giveaways are converted: running ones keep running so they end properly, entrants become entries', async () => {
    const { convertLegacy, migrateLegacyGiveaways } = await import('../src/features/giveaways/utils/legacy.js');
    const ended = convertLegacy({
        isActive: false,
        endsAt: NOW,
        createdAt: new Date(NOW.getTime() - 86_400_000),
        hostId: HOST,
        requiredRoleId: ROLE,
        entrants: ['a', 'b', 'a'],
        winners: ['a'],
    });
    assert.equal(ended.set.status, 'ended');
    assert.deepEqual(ended.set.requirements, { roleIds: [ROLE], minLevel: 0 });
    assert.deepEqual(ended.entrants, ['a', 'b']);
    assert.equal(ended.set.entrantCount, 2);
    assert.ok(ended.set.endedAt);

    // The migration itself, against a fake collection
    const oldDoc = {
        _id: 'old1',
        guildId: GUILD,
        channelId: CHANNEL,
        messageId: null,
        prize: 'Old prize',
        endsAt: NOW,
        winnerCount: 1,
        hostId: HOST,
        isActive: true,
        entrants: ['a'],
    };
    const updates = [];
    const dropped = [];
    const collection = {
        indexes: async () => [
            { name: '_id_', key: { _id: 1 } },
            { name: 'messageId_1', key: { messageId: 1 }, unique: true },
        ],
        dropIndex: async (name) => dropped.push(name),
        find: () => ({ toArray: async () => [oldDoc] }),
        updateOne: async (filter, update) => updates.push(update),
    };
    const realCollection = Object.getOwnPropertyDescriptor(Giveaway, 'collection');
    Object.defineProperty(Giveaway, 'collection', { value: collection, configurable: true });
    GiveawayEntry.insertMany = /** @type {any} */ (async (docs) => entries.push(...docs));
    try {
        const { guild } = fakeGuild();
        const client = /** @type {any} */ ({ guilds: { cache: new Map([[GUILD, guild]]) } });
        assert.equal(await migrateLegacyGiveaways(client), 1);
    } finally {
        if (realCollection) Object.defineProperty(Giveaway, 'collection', realCollection);
        else delete (/** @type {any} */ (Giveaway).collection);
    }
    assert.deepEqual(dropped, ['messageId_1'], 'the old unique index that would block new giveaways is removed');
    assert.equal(updates[0].$set.status, 'running');
    assert.ok('entrants' in updates[0].$unset);
    assert.deepEqual(
        entries.map((entry) => entry.userId),
        ['a']
    );
});

test('the dashboard list never breaks on a giveaway with missing dates', async () => {
    const { giveawayView } = await import('../src/features/giveaways/utils/dashboard.js');
    const view = giveawayView(
        /** @type {any} */ ({ client: { users: { cache: new Map() } } }),
        /** @type {any} */ ({
            _id: 'x',
            guildId: GUILD,
            channelId: CHANNEL,
            prize: 'Odd',
            endsAt: 'not a date',
        })
    );
    assert.equal(view.endsAt, null);
    assert.equal(view.startsAt, null);
    assert.equal(view.status, 'ended');
    assert.deepEqual(view.winners, []);
});
