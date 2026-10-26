import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, Collection } from 'discord.js';
import { ServerStats } from '../src/features/serverStats/models/serverStats.js';
import { countFor, counterName, updateCounters } from '../src/features/serverStats/utils/counters.js';
import { serverStatsDashboard } from '../src/features/serverStats/utils/dashboard.js';

const GUILD = '400000000000000001';
const ROLE = '600000000000000001';

let stored;
beforeEach(() => {
    stored = null;
    const lean = (value) => ({ lean: async () => (value ? structuredClone(value) : null) });
    ServerStats.findOne = /** @type {any} */ (() => lean(stored));
    ServerStats.findOneAndUpdate = /** @type {any} */ (
        (filter, update) => {
            stored ??= { guildId: GUILD, categoryId: null, counters: [] };
            Object.assign(stored, update.$set ?? {});
            if (update.$push) stored.counters.push(update.$push.counters);
            if (update.$pull)
                stored.counters = stored.counters.filter((c) => c.channelId !== update.$pull.counters.channelId);
            if (update.$set?.['counters.$.template']) {
                stored.counters.find((c) => c.channelId === filter['counters.channelId']).template =
                    update.$set['counters.$.template'];
            }
            return lean(stored);
        }
    );
});

/** A server with 3 people (one with the role) and 2 bots. */
function fakeGuild({ allLoaded = true } = {}) {
    const members = new Collection();
    for (const [id, bot, roles] of [
        ['1', false, [ROLE]],
        ['2', false, []],
        ['3', false, []],
        ['4', true, []],
        ['5', true, []],
    ]) {
        if (!allLoaded && id !== '1') continue;
        members.set(id, { id, user: { bot }, roles: { cache: new Map(roles.map((r) => [r, {}])) } });
    }
    const channels = new Collection();
    const created = [];
    const deleted = [];
    const guild = {
        id: GUILD,
        name: 'Test',
        memberCount: 5,
        premiumSubscriptionCount: 7,
        members: { cache: members, me: { id: 'bot' }, fetch: async () => {} },
        roles: {
            cache: new Collection([
                [GUILD, { id: GUILD, name: '@everyone' }],
                [ROLE, { id: ROLE, name: 'VIP', members: members.filter((m) => m.roles.cache.has(ROLE)) }],
            ]),
        },
        channels: {
            cache: channels,
            create: async (options) => {
                const channel = {
                    id: `c${created.length + 1}`,
                    name: options.name,
                    type: options.type,
                    isThread: () => false,
                    setName: async (name) => (channel.name = name),
                    delete: async () => (deleted.push(channel.id), channels.delete(channel.id)),
                    createOptions: options,
                };
                created.push(channel);
                channels.set(channel.id, channel);
                return channel;
            },
        },
    };
    return { guild: /** @type {any} */ (guild), created, deleted, channels };
}

test('each counter type counts the right thing', () => {
    const { guild } = fakeGuild();
    const count = (type, roleId = null) => countFor(guild, { type, roleId, channelId: 'x', template: '{count}' });
    assert.equal(count('members'), 5);
    assert.equal(count('humans'), 3);
    assert.equal(count('bots'), 2);
    assert.equal(count('boosts'), 7);
    assert.equal(count('roles'), 1, '@everyone is not counted');
    assert.equal(count('role', ROLE), 1);
    assert.equal(count('role', 'deleted'), null);
});

test('without every member loaded, people and bots are not guessed', () => {
    const { guild } = fakeGuild({ allLoaded: false });
    assert.equal(countFor(guild, { type: 'humans', channelId: 'x', template: '' }), null);
    assert.equal(countFor(guild, { type: 'members', channelId: 'x', template: '' }), 5, 'the total is always known');
});

test('names fill in the number and role', () => {
    const { guild } = fakeGuild();
    guild.memberCount = 9257;
    assert.equal(
        counterName(guild, { type: 'members', channelId: 'x', template: '👥 Members: {count}' }, 9257),
        '👥 Members: 9,257'
    );
    assert.equal(
        counterName(guild, { type: 'role', roleId: ROLE, channelId: 'x', template: '⭐ {role}: {count}' }, 1),
        '⭐ VIP: 1'
    );
});

test('only counters whose number changed are renamed', async () => {
    const { guild, channels } = fakeGuild();
    let renames = 0;
    for (const [id, name] of [
        ['a', '👥 Members: 5'],
        ['b', '🤖 Bots: 1'],
    ]) {
        channels.set(id, { id, name, setName: async (value) => (renames++, (channels.get(id).name = value)) });
    }
    const renamed = await updateCounters(guild, [
        { type: 'members', channelId: 'a', template: '👥 Members: {count}' },
        { type: 'bots', channelId: 'b', template: '🤖 Bots: {count}' },
        { type: 'members', channelId: 'deleted', template: '{count}' },
    ]);
    assert.equal(renamed, 1);
    assert.equal(renames, 1);
    assert.equal(channels.get('b').name, '🤖 Bots: 2');
});

test('adding a counter makes a locked voice channel in a stats category; at most 5', async () => {
    const { guild, created } = fakeGuild();
    const admin = /** @type {any} */ ({ user: { username: 'admin' } });
    const result = await serverStatsDashboard(guild, admin, { op: 'add', type: 'members' });
    assert.ok(result.ok);
    assert.equal(created[0].type, ChannelType.GuildCategory);
    assert.equal(created[1].type, ChannelType.GuildVoice);
    assert.equal(created[1].name, '👥 Members: 5');
    assert.ok(created[1].createOptions.permissionOverwrites[0].deny.length > 0, 'nobody can join it');

    await serverStatsDashboard(guild, admin, { op: 'add', type: 'bots' });
    assert.equal(
        created.filter((c) => c.type === ChannelType.GuildCategory).length,
        1,
        'one category for all counters'
    );

    assert.equal(
        (await serverStatsDashboard(guild, admin, { op: 'add', type: 'role' })).ok,
        false,
        'a role counter needs a role'
    );
    for (let i = 0; i < 3; i++) await serverStatsDashboard(guild, admin, { op: 'add', type: 'boosts' });
    assert.match((await serverStatsDashboard(guild, admin, { op: 'add', type: 'boosts' })).error, /at most 5/);
});

test('renaming needs {count}, and removing deletes the channel', async () => {
    const { guild, deleted } = fakeGuild();
    const admin = /** @type {any} */ ({ user: { username: 'admin' } });
    await serverStatsDashboard(guild, admin, { op: 'add', type: 'members' });
    const channelId = stored.counters[0].channelId;

    assert.match(
        (await serverStatsDashboard(guild, admin, { op: 'rename', channelId, template: 'No number' })).error,
        /\{count\}/
    );
    assert.ok((await serverStatsDashboard(guild, admin, { op: 'rename', channelId, template: 'Folks: {count}' })).ok);
    assert.equal(stored.counters[0].template, 'Folks: {count}');

    await serverStatsDashboard(guild, admin, { op: 'remove', channelId });
    assert.deepEqual(deleted, [channelId]);
    assert.equal(stored.counters.length, 0);
});
