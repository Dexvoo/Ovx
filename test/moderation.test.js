import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import {
    checkTarget,
    parseDuration,
    formatDuration,
    auditReason,
    MAX_MUTE_MS,
} from '../src/features/moderation/utils/checks.js';
import { messagesToPurge } from '../src/features/moderation/subcommands/purge.js';
import { autocomplete } from '../src/features/moderation/commands/moderation.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';
import { ModCase, ModCaseCounter } from '../src/features/moderation/models/modCase.js';
import { TempBan, ChannelLock } from '../src/features/moderation/models/moderationTimers.js';
import {
    lockChannel,
    unlockChannel,
    endTempBans,
    endLocks,
    parseSlowmode,
} from '../src/features/moderation/utils/timers.js';

const OWNER = '100000000000000001';
const MOD = '100000000000000002';
const TARGET = '100000000000000003';
const BOT = '100000000000000004';

const person = (id, position, { admin = false } = {}) => ({
    id,
    roles: { highest: { position } },
    permissions: { has: (flag) => admin && flag === PermissionFlagsBits.Administrator },
});

// ---------- Who can be acted on ----------

test('moderators can only act on people below them, and Ovx only on people below it', () => {
    const people = (targetPosition, extra = {}) => ({
        moderator: person(MOD, 5),
        target: person(TARGET, targetPosition, extra),
        me: person(BOT, 8),
        ownerId: OWNER,
    });

    assert.equal(checkTarget('ban', people(4)), null);
    assert.equal(checkTarget('ban', people(5)), 'target_higher_than_you', 'equal roles are not enough');
    assert.equal(
        checkTarget('kick', { ...people(6), moderator: person(OWNER, 1) }),
        null,
        'the owner outranks everyone'
    );
    assert.equal(checkTarget('kick', { ...people(9), moderator: person(OWNER, 1) }), 'target_higher_than_bot');
    assert.equal(checkTarget('mute', people(1, { admin: true })), 'target_admin');
    assert.equal(checkTarget('ban', { ...people(1), target: person(OWNER, 1) }), 'target_owner');
});

test('nobody punishes themselves or Ovx, but changing your own nickname is fine', () => {
    const me = person(BOT, 8);
    const moderator = person(MOD, 5);
    assert.equal(checkTarget('ban', { moderator, target: moderator, me, ownerId: OWNER }), 'target_self');
    assert.equal(checkTarget('nickname', { moderator, target: moderator, me, ownerId: OWNER }), null);
    assert.equal(checkTarget('kick', { moderator, target: me, me, ownerId: OWNER }), 'target_bot_self');
    assert.equal(checkTarget('nickname', { moderator, target: me, me, ownerId: OWNER }), 'use_dashboard_nickname');
});

// ---------- Durations ----------

test('mute lengths are read the way people type them', () => {
    assert.equal(parseDuration('10m'), 600_000);
    assert.equal(parseDuration('1h 30m'), 5_400_000);
    assert.equal(parseDuration('1h30m'), 5_400_000);
    assert.equal(parseDuration('2 days'), 172_800_000);
    assert.equal(parseDuration('1 hour and 5 minutes'), 3_900_000);
    assert.equal(parseDuration('15'), 900_000, 'a plain number is minutes');
    assert.equal(parseDuration('4w'), MAX_MUTE_MS);
    for (const nonsense of ['', 'soon', '5 potatoes', '1h lol', '-5m']) {
        assert.equal(parseDuration(nonsense), null, nonsense);
    }
});

test('durations are shown with their two largest units', () => {
    assert.equal(formatDuration(5_400_000), '1 hour 30 minutes');
    assert.equal(formatDuration(86_400_000 + 3_600_000 + 60_000), '1 day 1 hour');
    assert.equal(formatDuration(60_000), '1 minute');
});

test('the audit log names the moderator, since Discord would only show Ovx', () => {
    assert.equal(auditReason({ username: 'dexvo' }, 'spam'), 'By @dexvo: spam');
    assert.equal(auditReason({ username: 'dexvo' }, null), 'By @dexvo: No reason given');
    assert.ok(auditReason({ username: 'x' }, 'y'.repeat(600)).length <= 512);
});

test('mute length suggestions explain what was typed', async () => {
    let choices;
    const interaction = (typed, subcommand = 'mute') => ({
        options: { getFocused: () => typed, getSubcommand: () => subcommand },
        respond: async (list) => (choices = list),
    });

    await autocomplete(interaction('1h30m'));
    assert.deepEqual(choices[0], { name: '1 hour 30 minutes', value: '1h30m' });

    await autocomplete(interaction(''));
    assert.deepEqual(
        choices.map((choice) => choice.name),
        ['1 minute', '5 minutes', '10 minutes', '1 hour', '6 hours', '1 day', '1 week']
    );

    await autocomplete(interaction('60d'));
    assert.ok(!choices.some((choice) => choice.value === '60d'), 'longer than Discord allows');

    await autocomplete(interaction('60d', 'ban'));
    assert.deepEqual(choices[0], { name: '8 weeks 4 days', value: '60d' }, 'a ban can be longer');
    await autocomplete(interaction('', 'slowmode'));
    assert.equal(choices[0].value, 'off');
});

// ---------- Purge ----------

test('purge skips pinned messages, other people when filtered, and messages too old to bulk-delete', () => {
    const now = Date.now();
    const message = (id, authorId, ageDays, pinned = false) => ({
        id,
        pinned,
        author: { id: authorId },
        createdTimestamp: now - ageDays * 86_400_000,
    });
    const messages = [
        message('1', TARGET, 0),
        message('2', MOD, 0),
        message('3', TARGET, 0, true),
        message('4', TARGET, 1),
        message('5', TARGET, 15),
    ];

    assert.deepEqual(
        messagesToPurge(messages, { amount: 10, now }).map((m) => m.id),
        ['1', '2', '4']
    );
    assert.deepEqual(
        messagesToPurge(messages, { amount: 10, userId: TARGET, now }).map((m) => m.id),
        ['1', '4']
    );
    assert.deepEqual(
        messagesToPurge(messages, { amount: 1, now }).map((m) => m.id),
        ['1']
    );
});

// ---------- Commands ----------

let replies;
let bans;
let actions;

/**
 * A fake slash command interaction for /moderation.
 * @param {{ options?: Record<string, any>, member?: any, targetInGuild?: boolean, missing?: string[] }} [setup]
 */
function fakeInteraction({ options = {}, targetInGuild = true, missing = [] } = {}) {
    const targetUser = { id: TARGET, username: 'target', toString: () => `<@${TARGET}>`, send: async () => {} };
    const target = {
        ...person(TARGET, 1),
        user: targetUser,
        communicationDisabledUntilTimestamp: null,
        toString: () => `<@${TARGET}>`,
        kick: async (reason) => actions.push(['kick', reason]),
        timeout: async (ms, reason) => actions.push(['timeout', ms, reason]),
    };
    const guild = {
        id: '400000000000000001',
        name: 'Test',
        ownerId: OWNER,
        preferredLocale: 'en-GB',
        members: {
            me: person(BOT, 8),
            fetch: async (id) =>
                targetInGuild && id === TARGET ? target : Promise.reject(new Error('Unknown Member')),
        },
        bans: {
            fetch: async (id) => (bans.has(id) ? { user: { id } } : Promise.reject(new Error('Unknown Ban'))),
            create: async (id, details) => (bans.set(id, details), actions.push(['ban', id, details])),
            remove: async (id, reason) => (bans.delete(id), actions.push(['unban', id, reason])),
        },
    };
    const interaction = {
        guild,
        guildId: guild.id,
        locale: 'en-GB',
        user: { id: MOD, username: 'mod' },
        member: person(MOD, 5),
        deferred: false,
        replied: false,
        async deferReply() {
            interaction.deferred = true;
        },
        options: {
            getUser: (name) => (name === 'user' ? targetUser : null),
            getMember: (name) => (name === 'user' && targetInGuild ? target : null),
            getString: (name) => options[name] ?? null,
            getInteger: (name) => options[name] ?? null,
        },
        client: {
            utils: {
                Translate: (key, locale, args = {}) =>
                    `${key}${Object.keys(args).length ? ` ${JSON.stringify(args)}` : ''}`,
                PermissionCheck: (_, perms, who) =>
                    who === guild.members.me && missing.length ? [false, [missing]] : [true],
                Embed: async (_, colour, title, description) => replies.push({ colour, title, description }),
            },
        },
    };
    interaction.member.user = interaction.user;
    return interaction;
}

let cases;
let tempBans;
let locks;

beforeEach(() => {
    replies = [];
    bans = new Map();
    actions = [];
    cases = [];
    tempBans = [];
    locks = [];
    Guild_Settings_Cache.get = async () => ({ embedColour: null });
    ModCaseCounter.findOneAndUpdate = /** @type {any} */ (async () => ({ lastCase: cases.length + 1 }));
    ModCase.create = /** @type {any} */ (async (doc) => (cases.push(doc), doc));

    const matches = (doc, filter) =>
        Object.entries(filter).every(([key, value]) =>
            value && typeof value === 'object' && !(value instanceof Date)
                ? true
                : String(doc[key]) === String(value) ||
                  (value instanceof Date && doc[key]?.getTime() === value.getTime())
        );
    TempBan.deleteOne = /** @type {any} */ (
        async (filter) => {
            const before = tempBans.length;
            tempBans = tempBans.filter((doc) => !matches(doc, filter));
            return { deletedCount: before - tempBans.length };
        }
    );
    TempBan.updateOne = /** @type {any} */ (
        async (filter, update, options) => {
            let doc = tempBans.find((item) => matches(item, filter));
            if (!doc && options?.upsert) tempBans.push((doc = { _id: `t${tempBans.length}`, ...filter }));
            if (doc) Object.assign(doc, update.$set);
            return { modifiedCount: doc ? 1 : 0 };
        }
    );
    TempBan.find = /** @type {any} */ (
        (filter) => ({
            limit: () => ({
                lean: async () =>
                    tempBans.filter((doc) => doc.expiresAt <= filter.expiresAt.$lte).map((doc) => ({ ...doc })),
            }),
        })
    );
    ChannelLock.create = /** @type {any} */ (
        async (doc) => {
            if (locks.some((lock) => lock.channelId === doc.channelId))
                throw Object.assign(new Error('dup'), { code: 11000 });
            locks.push({ _id: `l${locks.length}`, ...doc });
        }
    );
    ChannelLock.deleteOne = /** @type {any} */ (
        async (filter) => {
            locks = locks.filter((lock) => !matches(lock, filter));
        }
    );
    ChannelLock.updateOne = /** @type {any} */ (
        async (filter, update) => {
            const lock = locks.find((item) => matches(item, filter));
            if (lock) Object.assign(lock, update.$set);
            return { modifiedCount: lock ? 1 : 0 };
        }
    );
    ChannelLock.find = /** @type {any} */ (
        (filter) => ({
            limit: () => ({
                lean: async () =>
                    locks.filter((lock) => lock.until && lock.until <= filter.until.$lte).map((lock) => ({ ...lock })),
            }),
        })
    );
});

test('ban: records the moderator in the audit log and can delete recent messages', async () => {
    const { execute } = await import('../src/features/moderation/subcommands/ban.js');
    await execute(fakeInteraction({ options: { reason: 'spam', 'delete-messages': 3600 } }));

    assert.deepEqual(actions, [['ban', TARGET, { reason: 'By @mod: spam', deleteMessageSeconds: 3600 }]]);
    assert.match(replies[0].description, /commands\.moderation\.banned/);
});

test('ban: works by ID for someone who already left, and not twice', async () => {
    const { execute } = await import('../src/features/moderation/subcommands/ban.js');
    await execute(fakeInteraction({ targetInGuild: false }));
    assert.equal(actions[0][0], 'ban');
    assert.doesNotMatch(replies[0].description, /dm_failed/, 'nobody to message, so no warning');

    await execute(fakeInteraction({ targetInGuild: false }));
    assert.match(replies[1].description, /already_banned/);
    assert.equal(actions.length, 1);
});

test('nothing happens when Ovx is missing the permission, and it says which', async () => {
    const { execute } = await import('../src/features/moderation/subcommands/kick.js');
    await execute(fakeInteraction({ missing: ['KickMembers'] }));
    assert.equal(actions.length, 0);
    assert.match(replies[0].description, /bot_missing_perms.*Kick Members/);
});

test('mute: refuses lengths it cannot read or that Discord does not allow', async () => {
    const { execute } = await import('../src/features/moderation/subcommands/mute.js');
    await execute(fakeInteraction({ options: { duration: 'soon' } }));
    await execute(fakeInteraction({ options: { duration: '30d' } }));
    assert.match(replies[0].description, /bad_duration/);
    assert.match(replies[1].description, /duration_range/);

    await execute(fakeInteraction({ options: { duration: '10m', reason: 'calm down' } }));
    assert.deepEqual(actions, [['timeout', 600_000, 'By @mod: calm down']]);
});

test('unmute: only for someone who is muted', async () => {
    const { execute } = await import('../src/features/moderation/subcommands/unmute.js');
    await execute(fakeInteraction());
    assert.match(replies[0].description, /not_muted/);
    assert.equal(actions.length, 0);
});

test('a moderation command never reaches Discord for someone above the moderator', async () => {
    const { execute } = await import('../src/features/moderation/subcommands/kick.js');
    const interaction = fakeInteraction();
    interaction.member.roles.highest.position = 0;
    await execute(interaction);
    assert.equal(actions.length, 0);
    assert.match(replies[0].description, /target_higher_than_you/);
});

test('/moderation has its actions', async () => {
    const { commandData } = await import('../src/features/moderation/commands/moderation.js');
    assert.deepEqual(
        commandData.toJSON().options.map((option) => option.name),
        [
            'ban',
            'unban',
            'kick',
            'mute',
            'unmute',
            'purge',
            'nickname',
            'warn',
            'unwarn',
            'history',
            'note',
            'lock',
            'unlock',
            'slowmode',
        ]
    );
});

// ---------- Temporary bans ----------

test('ban with a duration: saved to end by itself, and the member is told how long', async () => {
    const { execute } = await import('../src/features/moderation/subcommands/ban.js');
    const before = Date.now();
    await execute(fakeInteraction({ options: { duration: '1w', reason: 'raid' } }));

    assert.equal(actions[0][2].reason, 'By @mod: raid (for 1 week)');
    assert.equal(tempBans.length, 1);
    assert.ok(tempBans[0].expiresAt.getTime() >= before + 604_800_000);
    assert.equal(cases[0].durationMs, 604_800_000);
    assert.match(replies[0].description, /banned_temp/);

    await execute(fakeInteraction({ options: { duration: '400d' } }));
    assert.match(replies[1].description, /ban_duration_range/);
});

test('a permanent ban replaces an older temporary one', async () => {
    const { execute } = await import('../src/features/moderation/subcommands/ban.js');
    tempBans.push({ _id: 'old', guildId: '400000000000000001', userId: TARGET, expiresAt: new Date(0) });
    await execute(fakeInteraction());
    assert.equal(tempBans.length, 0);
});

/** A client whose one server has the given bans, for the timers. */
function timerClient(removeBan) {
    const guild = {
        id: '400000000000000001',
        name: 'Test',
        bans: { remove: removeBan },
        channels: { cache: new Map() },
    };
    return {
        guild,
        client: /** @type {any} */ ({
            user: { id: BOT, username: 'Ovx' },
            guilds: { cache: new Map([[guild.id, guild]]) },
        }),
    };
}

test('temporary bans end when due, recorded as an unban by Ovx', async () => {
    const removed = [];
    const { client } = timerClient(async (id, reason) => removed.push([id, reason]));
    const now = new Date('2026-10-13T12:00:00Z');
    tempBans.push(
        {
            _id: 'a',
            guildId: '400000000000000001',
            userId: TARGET,
            username: 'target',
            expiresAt: new Date('2026-10-13T11:00:00Z'),
            caseNumber: 4,
        },
        {
            _id: 'b',
            guildId: '400000000000000001',
            userId: MOD,
            username: 'later',
            expiresAt: new Date('2026-10-14T00:00:00Z'),
        }
    );

    assert.equal(await endTempBans(client, now), 1);
    assert.deepEqual(removed, [[TARGET, 'Temporary ban ended (case #4)']]);
    assert.deepEqual(
        tempBans.map((ban) => ban._id),
        ['b'],
        'the later one waits'
    );
    assert.equal(cases[0].action, 'unban');
    assert.equal(cases[0].moderatorId, BOT);
});

test('a temporary ban that cannot be ended yet is tried again later; one already lifted is dropped', async () => {
    const now = new Date('2026-10-13T12:00:00Z');
    const failing = timerClient(async () => {
        throw Object.assign(new Error('Missing Permissions'), { code: 50013 });
    });
    tempBans.push({
        _id: 'a',
        guildId: '400000000000000001',
        userId: TARGET,
        username: 'target',
        expiresAt: new Date(0),
    });
    assert.equal(await endTempBans(failing.client, now), 0);
    assert.equal(tempBans.length, 1);
    assert.ok(tempBans[0].expiresAt > now, 'moved an hour on');
    assert.equal(cases.length, 0);

    const lifted = timerClient(async () => {
        throw Object.assign(new Error('Unknown Ban'), { code: 10026 });
    });
    tempBans[0].expiresAt = new Date(0);
    await endTempBans(lifted.client, now);
    assert.equal(tempBans.length, 0);
    assert.equal(cases.length, 0, 'someone else unbanned them; that was recorded then');
});

// ---------- Locks ----------

/** A permission set like discord.js's, from permission names. */
const perms = (names) => ({
    has: (name) => names.includes(name),
    get bitfield() {
        return BigInt(names.length);
    },
});

/** A channel whose @everyone overwrite starts as given (or missing). */
function fakeChannel(start) {
    const everyone = '400000000000000001';
    const overwrites = new Map(start ? [[everyone, { allow: perms(start.allow), deny: perms(start.deny) }]] : []);
    const edits = [];
    const channel = {
        id: '500000000000000001',
        type: 0,
        isThread: () => false,
        guild: { id: everyone, roles: { everyone: { id: everyone } } },
        permissionOverwrites: {
            cache: overwrites,
            edit: async (id, values) => {
                edits.push(values);
                const current = overwrites.get(id) ?? { allow: perms([]), deny: perms([]) };
                const allow = new Set(LOCKED.filter((name) => current.allow.has(name)));
                const deny = new Set(LOCKED.filter((name) => current.deny.has(name)));
                const others = {
                    allow: start?.allow.filter((n) => !LOCKED.includes(n)) ?? [],
                    deny: start?.deny.filter((n) => !LOCKED.includes(n)) ?? [],
                };
                for (const [name, value] of Object.entries(values)) {
                    allow.delete(name);
                    deny.delete(name);
                    if (value === true) allow.add(name);
                    if (value === false) deny.add(name);
                }
                overwrites.set(id, {
                    allow: perms([...others.allow, ...allow]),
                    deny: perms([...others.deny, ...deny]),
                });
            },
            delete: async (id) => overwrites.delete(id),
        },
    };
    return { channel, overwrites, edits, everyone };
}
const LOCKED = ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads'];

test('a lock stops everyone talking, and unlocking puts back exactly what was there', async () => {
    const { channel, overwrites, everyone } = fakeChannel({
        allow: ['SendMessages'],
        deny: ['AddReactions', 'CreatePublicThreads'],
    });
    const details = { moderatorName: 'mod', reason: null, until: null, auditReason: 'By @mod' };
    assert.equal(await lockChannel(channel, details), 'locked');
    for (const name of LOCKED) assert.ok(overwrites.get(everyone).deny.has(name), name);
    assert.equal(await lockChannel(channel, details), 'already_locked');

    await unlockChannel(channel, locks[0], 'By @mod');
    const after = overwrites.get(everyone);
    assert.ok(after.allow.has('SendMessages'), 'was allowed, allowed again');
    assert.ok(after.deny.has('CreatePublicThreads'), 'was denied, still denied');
    assert.ok(after.deny.has('AddReactions'), 'other permissions untouched');
    assert.ok(!after.deny.has('SendMessagesInThreads'));
    assert.equal(locks.length, 0);
});

test('unlocking a channel that had no overwrite removes the one the lock made', async () => {
    const { channel, overwrites, everyone } = fakeChannel(null);
    await lockChannel(channel, { moderatorName: 'mod', reason: null, until: null, auditReason: 'x' });
    assert.ok(overwrites.has(everyone));
    await unlockChannel(channel, locks[0], 'x');
    assert.equal(overwrites.has(everyone), false);
});

test('a lock that fails in Discord is not left saved', async () => {
    const { channel } = fakeChannel(null);
    channel.permissionOverwrites.edit = async () => {
        throw new Error('Missing Permissions');
    };
    await assert.rejects(lockChannel(channel, { moderatorName: 'mod', reason: null, until: null, auditReason: 'x' }));
    assert.equal(locks.length, 0);
});

test('timed locks end by themselves, with a notice', async () => {
    const { channel, overwrites, everyone } = fakeChannel(null);
    const { client, guild } = timerClient(async () => {});
    guild.channels.cache.set(channel.id, channel);
    const now = new Date('2026-10-13T12:00:00Z');
    await lockChannel(channel, {
        moderatorName: 'mod',
        reason: null,
        until: new Date('2026-10-13T11:59:00Z'),
        auditReason: 'x',
    });

    const notices = [];
    assert.equal(await endLocks(client, { now, notice: async (target) => notices.push(target.id) }), 1);
    assert.equal(overwrites.has(everyone), false);
    assert.deepEqual(notices, [channel.id]);
    assert.equal(locks.length, 0);
});

test('slowmode lengths: a plain number is seconds, "off" turns it off', () => {
    assert.equal(parseSlowmode('off'), 0);
    assert.equal(parseSlowmode('0'), 0);
    assert.equal(parseSlowmode('30'), 30);
    assert.equal(parseSlowmode('2m'), 120);
    assert.equal(parseSlowmode('1h 30m'), 5400);
    assert.equal(parseSlowmode('fast'), null);
});

// ---------- Notes ----------

test('note: recorded privately, and the member is not messaged', async () => {
    const { execute } = await import('../src/features/moderation/subcommands/note.js');
    let messaged = false;
    const interaction = fakeInteraction({ options: { note: '  Was rude in voice, keep an eye on them ' } });
    interaction.options.getUser('user').send = async () => (messaged = true);
    await execute(interaction);

    assert.equal(cases[0].action, 'note');
    assert.equal(cases[0].reason, 'Was rude in voice, keep an eye on them');
    assert.equal(messaged, false);
    assert.match(replies[0].description, /note_added/);
});
