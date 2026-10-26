import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import { ModCase, ModCaseCounter } from '../src/features/moderation/models/modCase.js';
import { createCase, createMongoCaseStore, deleteCase } from '../src/features/moderation/utils/cases.js';
import { recordDiscordCase } from '../src/features/moderation/utils/discordCases.js';
import { moderationDetails } from '../src/features/logging/utils/logChannel.js';
import { parseAuditReason, auditReason } from '../src/features/moderation/utils/checks.js';
import Logs_Cache from '../src/features/logging/cache/logs.cache.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';
import Moderation_Config_Cache from '../src/features/moderation/cache/moderationConfig.cache.js';
import { runWarnAction } from '../src/features/moderation/utils/warnActions.js';

const GUILD = '400000000000000001';
const BOT = '100000000000000004';
const MOD = '100000000000000002';
const TARGET = '100000000000000003';

let stored;
let lastCase;
let findQuery;

beforeEach(() => {
    stored = [];
    lastCase = 0;
    findQuery = null;
    ModCaseCounter.findOneAndUpdate = /** @type {any} */ (async () => ({ guildId: GUILD, lastCase: ++lastCase }));
    ModCase.create = /** @type {any} */ (
        async (doc) => (stored.push({ createdAt: new Date(), ...doc }), stored.at(-1))
    );
    ModCase.find = /** @type {any} */ (
        (query) => (
            (findQuery = query),
            {
                sort: () => ({
                    limit: (n) => ({
                        lean: async () =>
                            stored
                                .filter(
                                    (doc) =>
                                        doc.guildId === query.guildId && (!query.userId || doc.userId === query.userId)
                                )
                                .sort((a, b) => b.number - a.number)
                                .slice(0, n),
                    }),
                }),
            }
        )
    );
    ModCase.findOneAndDelete = /** @type {any} */ (
        (filter) => ({
            lean: async () => {
                const index = stored.findIndex((doc) =>
                    Object.entries(filter).every(([key, value]) => doc[key] === value)
                );
                return index === -1 ? null : stored.splice(index, 1)[0];
            },
        })
    );
    ModCase.aggregate = /** @type {any} */ (
        async ([{ $match }]) => {
            const counts = {};
            for (const doc of stored.filter((d) => d.guildId === $match.guildId && d.userId === $match.userId)) {
                counts[doc.action] = (counts[doc.action] ?? 0) + 1;
            }
            return Object.entries(counts).map(([_id, count]) => ({ _id, count }));
        }
    );
    Logs_Cache.get = async () => ({ guildId: GUILD });
    Guild_Settings_Cache.get = async () => ({ embedColour: null });
    Moderation_Config_Cache.get = async () => ({ guildId: GUILD, warnActions: [] });
});

// ---------- Storage ----------

test('cases are numbered per server and keep names as they were', async () => {
    const first = await createCase({
        guildId: GUILD,
        action: 'warn',
        user: { id: TARGET, username: 'target' },
        moderator: { id: MOD, username: 'mod' },
        reason: 'spam',
    });
    const second = await createCase({
        guildId: GUILD,
        action: 'ban',
        user: { id: TARGET, username: 'target' },
        moderator: null,
    });

    assert.equal(first.number, 1);
    assert.equal(second.number, 2);
    assert.equal(first.moderatorName, 'mod');
    assert.equal(second.moderatorName, null);
    assert.equal(second.source, 'command');
    assert.ok(!('_id' in first), 'nothing internal is exposed');
});

test('the dashboard search: a user ID matches exactly, a name is matched literally, odd filters are ignored', async () => {
    const store = createMongoCaseStore();

    await store.list(GUILD, { member: TARGET });
    assert.deepEqual(findQuery, { guildId: GUILD, userId: TARGET });

    await store.list(GUILD, { member: 'a.b*', action: 'warn', before: '20' });
    assert.equal(findQuery.username.source, 'a\\.b\\*');
    assert.equal(findQuery.action, 'warn');
    assert.deepEqual(findQuery.number, { $lt: 20 });

    await store.list(GUILD, { action: 'nuke', before: '-1' });
    assert.deepEqual(findQuery, { guildId: GUILD }, 'unknown actions and bad cursors are dropped');
});

test('unwarn only ever removes warnings', async () => {
    stored.push({ guildId: GUILD, number: 1, action: 'ban', userId: TARGET, username: 't' });
    stored.push({ guildId: GUILD, number: 2, action: 'warn', userId: TARGET, username: 't' });

    assert.equal(await deleteCase(GUILD, 1, { onlyAction: 'warn' }), null);
    assert.equal((await deleteCase(GUILD, 2, { onlyAction: 'warn' })).number, 2);
    assert.equal(await deleteCase(GUILD, 0), null);
    assert.equal(stored.length, 1);
});

// ---------- Who did it ----------

test('the punishment log credits the moderator behind /moderation, but only when Ovx really did it', () => {
    const reason = auditReason({ username: 'dexvo' }, 'spam');
    assert.deepEqual(parseAuditReason(reason), { moderatorName: 'dexvo', reason: 'spam' });

    const byBot = { executor: { id: BOT, toString: () => '<@bot>' }, reason };
    assert.deepEqual(moderationDetails(byBot, BOT), { moderator: '@dexvo (via Ovx)', reason: 'spam' });

    // Someone typing the same format into Discord's ban box is shown as themselves
    const spoofed = { executor: { id: MOD, toString: () => `<@${MOD}>` }, reason };
    assert.deepEqual(moderationDetails(spoofed, BOT), { moderator: `<@${MOD}>`, reason });

    assert.deepEqual(moderationDetails(null, BOT, 'old reason'), { moderator: 'Unknown', reason: 'old reason' });
});

/** A guild whose audit log holds `entries`. */
function fakeGuild(entries, { canViewAudit = true } = {}) {
    return {
        id: GUILD,
        name: 'Test',
        client: { user: { id: BOT } },
        members: { me: { permissions: { has: (flag) => canViewAudit && flag === PermissionFlagsBits.ViewAuditLog } } },
        fetchAuditLogs: async ({ type }) => ({
            entries: {
                find: (match) => entries.filter((entry) => entry.type === type).find(match),
            },
        }),
    };
}

test('actions done in Discord itself become cases; Ovx’s own are left to the command that recorded them', async () => {
    const user = { id: TARGET, username: 'target' };
    const now = Date.now();
    const human = fakeGuild([
        {
            type: AuditLogEvent.MemberKick,
            targetId: TARGET,
            createdTimestamp: now,
            executor: { id: MOD, username: 'mod' },
            reason: 'rude',
        },
    ]);
    assert.equal(await recordDiscordCase(human, { type: AuditLogEvent.MemberKick, action: 'kick', user }), true);
    assert.equal(stored[0].source, 'discord');
    assert.equal(stored[0].moderatorName, 'mod');
    assert.equal(stored[0].reason, 'rude');

    const byOvx = fakeGuild([
        {
            type: AuditLogEvent.MemberKick,
            targetId: TARGET,
            createdTimestamp: now,
            executor: { id: BOT, username: 'Ovx' },
        },
    ]);
    assert.equal(await recordDiscordCase(byOvx, { type: AuditLogEvent.MemberKick, action: 'kick', user }), false);

    // Someone just leaving has no kick entry
    assert.equal(
        await recordDiscordCase(fakeGuild([]), { type: AuditLogEvent.MemberKick, action: 'kick', user }),
        false
    );
    assert.equal(stored.length, 1);
});

// ---------- Commands ----------

let replies;

function interaction({ options = {}, targetIsBot = false } = {}) {
    const person = (id, position) => ({ id, roles: { highest: { position } }, permissions: { has: () => false } });
    const targetUser = {
        id: TARGET,
        username: 'target',
        bot: targetIsBot,
        toString: () => `<@${TARGET}>`,
        send: async () => {},
        displayAvatarURL: () => null,
    };
    const target = { ...person(TARGET, 9), user: targetUser, toString: () => `<@${TARGET}>` };
    const guild = {
        id: GUILD,
        name: 'Test',
        ownerId: '1',
        preferredLocale: 'en-GB',
        members: { me: person(BOT, 1), fetch: async () => target },
        channels: { cache: new Map() },
    };
    const self = {
        guild,
        guildId: GUILD,
        locale: 'en-GB',
        user: { id: MOD, username: 'mod', toString: () => `<@${MOD}>` },
        member: { ...person(MOD, 10), user: { id: MOD, username: 'mod' } },
        async deferReply() {
            self.deferred = true;
        },
        options: {
            getUser: () => targetUser,
            getMember: () => target,
            getString: (name) => options[name] ?? null,
            getInteger: (name) => options[name] ?? null,
        },
        client: {
            utils: {
                Translate: (key, locale, args = {}) => `${key} ${JSON.stringify(args)}`,
                PermissionCheck: () => [true],
                Embed: async (_, colour, title, description) => replies.push({ title, description }),
            },
        },
    };
    return self;
}

beforeEach(() => {
    replies = [];
});

test('warn: recorded, counted, and allowed even when the member is above Ovx', async () => {
    const { execute } = await import('../src/features/moderation/subcommands/warn.js');
    await execute(interaction({ options: { reason: 'spam' } }));
    await execute(interaction({ options: { reason: 'more spam' } }));

    assert.equal(stored.length, 2);
    assert.deepEqual(
        stored.map((doc) => [doc.number, doc.action, doc.reason, doc.moderatorName]),
        [
            [1, 'warn', 'spam', 'mod'],
            [2, 'warn', 'more spam', 'mod'],
        ]
    );
    assert.match(replies[1].description, /"count":2/);
    assert.match(replies[1].description, /case_line {"number":2}/);
});

test('warn: bots cannot be warned', async () => {
    const { execute } = await import('../src/features/moderation/subcommands/warn.js');
    await execute(interaction({ options: { reason: 'x' }, targetIsBot: true }));
    assert.equal(stored.length, 0);
    assert.match(replies[0].description, /warn_bot/);
});

test('history: totals and the latest cases, newest first', async () => {
    stored.push(
        {
            guildId: GUILD,
            number: 1,
            action: 'warn',
            userId: TARGET,
            username: 't',
            reason: 'one',
            moderatorName: 'mod',
            createdAt: new Date(),
        },
        {
            guildId: GUILD,
            number: 2,
            action: 'mute',
            userId: TARGET,
            username: 't',
            reason: null,
            durationMs: 3_600_000,
            moderatorName: null,
            createdAt: new Date(),
        }
    );
    const { execute } = await import('../src/features/moderation/subcommands/history.js');
    await execute(interaction());

    const { description } = replies[0];
    assert.match(description, /history_totals {"warn":1,"mute":1,"kick":0,"ban":0,"note":0}/);
    assert.ok(description.indexOf('**#2**') < description.indexOf('**#1**'));
    assert.match(description, /\(1 hour\)/);
});

// ---------- Automatic actions ----------

/** A warn interaction whose target Ovx can (or can't) act on. */
function warnSetup({ rules, canAct = true, botHasPermission = true }) {
    Moderation_Config_Cache.get = async () => ({ guildId: GUILD, warnActions: rules });
    const done = [];
    const base = interaction();
    const target = {
        id: TARGET,
        user: { id: TARGET, username: 'target', send: async () => {} },
        bannable: canAct,
        kickable: canAct,
        moderatable: canAct,
        timeout: async (ms, reason) => done.push(['mute', ms, reason]),
        kick: async (reason) => done.push(['kick', reason]),
    };
    base.guild.members.me.permissions = { has: () => botHasPermission };
    base.guild.bans = { create: async (id, { reason }) => done.push(['ban', id, reason]) };
    base.client.user = { id: BOT, username: 'Ovx' };
    return { interaction: base, target, done };
}

test('a rule runs when a warning reaches its count exactly, as Ovx, and is recorded as a case', async () => {
    const {
        interaction: warnInteraction,
        target,
        done,
    } = warnSetup({
        rules: [{ warnings: 3, action: 'mute', durationMs: 3_600_000 }],
    });

    assert.equal(await runWarnAction(warnInteraction, target, 2), null, 'no rule at 2');
    const result = await runWarnAction(warnInteraction, target, 3);

    assert.deepEqual(done, [['mute', 3_600_000, 'Automatic: reached 3 warnings (warned by @mod)']]);
    assert.equal(result.caseNumber, 1);
    assert.equal(stored[0].action, 'mute');
    assert.equal(stored[0].moderatorName, 'Ovx');
    assert.equal(stored[0].durationMs, 3_600_000);
});

test('a rule that Ovx cannot carry out says why, and nothing is recorded', async () => {
    const above = warnSetup({ rules: [{ warnings: 1, action: 'ban', durationMs: null }], canAct: false });
    assert.equal((await runWarnAction(above.interaction, above.target, 1)).failed, 'auto_not_allowed');

    const noPermission = warnSetup({
        rules: [{ warnings: 1, action: 'kick', durationMs: null }],
        botHasPermission: false,
    });
    assert.equal((await runWarnAction(noPermission.interaction, noPermission.target, 1)).failed, 'auto_missing_perms');

    assert.equal(above.done.length + noPermission.done.length, 0);
    assert.equal(stored.length, 0);
});
