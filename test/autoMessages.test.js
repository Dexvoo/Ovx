import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Collection } from 'discord.js';
import { AutoMessage, StickyMessage } from '../src/features/autoMessages/models/autoMessages.js';
import {
    postDue,
    onMessage,
    repostSticky,
    forgetStickies,
    STICKY_QUIET_MS,
    STICKY_MAX_WAIT_MS,
} from '../src/features/autoMessages/utils/messages.js';
import { autoMessagesDashboard } from '../src/features/autoMessages/utils/dashboard.js';

const GUILD = '400000000000000001';
const CHANNEL = '500000000000000001';
const ID = 'a'.repeat(24);

let autos;
let stickies;
const lean = (value) => ({ lean: async () => structuredClone(value) });

beforeEach(() => {
    autos = [];
    stickies = [];
    forgetStickies(GUILD);
    AutoMessage.find = /** @type {any} */ (
        (filter) => {
            const list = autos.filter(
                (a) => a.guildId === GUILD && (!filter.nextRunAt || (a.enabled && a.nextRunAt <= filter.nextRunAt.$lte))
            );
            return { ...lean(list), limit: () => lean(list) };
        }
    );
    AutoMessage.updateOne = /** @type {any} */ (
        async (filter, update) => {
            const found = autos.find(
                (a) =>
                    String(a._id) === String(filter._id) &&
                    (!filter.nextRunAt || a.nextRunAt.getTime() === new Date(filter.nextRunAt).getTime())
            );
            if (found) Object.assign(found, update.$set);
            return { matchedCount: found ? 1 : 0, modifiedCount: found ? 1 : 0 };
        }
    );
    AutoMessage.countDocuments = /** @type {any} */ (async () => autos.length);
    AutoMessage.create = /** @type {any} */ (async (doc) => autos.push({ _id: `id${autos.length}`, ...doc }));
    StickyMessage.find = /** @type {any} */ (() => lean(stickies));
    StickyMessage.findOne = /** @type {any} */ (
        (filter) => lean(stickies.find((s) => s.channelId === filter.channelId) ?? null)
    );
    StickyMessage.countDocuments = /** @type {any} */ (async () => stickies.length);
    StickyMessage.updateOne = /** @type {any} */ (
        async (filter, update, options) => {
            let found = stickies.find((s) => s.channelId === filter.channelId);
            if (!found && options?.upsert) {
                found = { _id: `s${stickies.length}`, channelId: filter.channelId, ...update.$setOnInsert };
                stickies.push(found);
            }
            if (found) Object.assign(found, update.$set);
        }
    );
});

/** A server with one text channel Ovx can post in. */
function fakeGuild() {
    const sent = [];
    const deleted = [];
    const channel = {
        id: CHANNEL,
        name: 'general',
        lastMessageId: null,
        isTextBased: () => true,
        permissionsFor: () => ({ has: () => true }),
        send: async (options) => {
            const message = { id: `m${sent.length + 1}`, ...options };
            sent.push(message);
            channel.lastMessageId = message.id;
            return message;
        },
        messages: { delete: async (id) => deleted.push(id) },
    };
    const guild = {
        id: GUILD,
        name: 'Test',
        channels: { cache: new Collection([[CHANNEL, channel]]) },
        members: { me: { id: 'bot' } },
    };
    const client = { guilds: { cache: new Collection([[GUILD, guild]]) } };
    return { guild: /** @type {any} */ (guild), client: /** @type {any} */ (client), channel, sent, deleted };
}

const context = /** @type {any} */ ({ textChannelIds: new Set([CHANNEL]) });

test('due auto messages are posted once, without pinging, and then due one interval later', async () => {
    const { client, sent } = fakeGuild();
    const now = new Date('2026-10-13T12:00:00Z');
    autos.push({
        _id: ID,
        guildId: GUILD,
        channelId: CHANNEL,
        content: 'Read the rules @everyone',
        intervalMinutes: 60,
        enabled: true,
        skipIfQuiet: false,
        nextRunAt: new Date('2026-10-13T08:00:00Z'),
        lastMessageId: null,
    });

    assert.equal(await postDue(client, now), 1);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].allowedMentions, { parse: [] });
    assert.equal(autos[0].nextRunAt.toISOString(), '2026-10-13T13:00:00.000Z', 'one hour from now, not a burst');
    assert.equal(autos[0].lastMessageId, 'm1');
    assert.equal(await postDue(client, now), 0, 'not due again yet');
});

test('with "skip if nobody talked", a quiet channel is skipped', async () => {
    const { client, channel, sent } = fakeGuild();
    autos.push({
        _id: ID,
        guildId: GUILD,
        channelId: CHANNEL,
        content: 'Hi',
        intervalMinutes: 10,
        enabled: true,
        skipIfQuiet: true,
        nextRunAt: new Date(0),
        lastMessageId: 'm0',
    });
    channel.lastMessageId = 'm0';
    assert.equal(await postDue(client, new Date()), 0);
    assert.equal(sent.length, 0);

    autos[0].nextRunAt = new Date(0);
    channel.lastMessageId = 'someone-else';
    assert.equal(await postDue(client, new Date()), 1);
});

test('a sticky is moved to the bottom: the old copy is deleted', async () => {
    const { guild, channel, sent, deleted } = fakeGuild();
    stickies.push({ _id: 's0', guildId: GUILD, channelId: CHANNEL, content: 'Stay on topic', lastMessageId: 'old' });
    channel.lastMessageId = 'someone';
    await repostSticky(guild, CHANNEL);
    assert.deepEqual(deleted, ['old']);
    assert.equal(sent[0].content, 'Stay on topic');
    assert.equal(stickies[0].lastMessageId, 'm1');

    await repostSticky(guild, CHANNEL);
    assert.equal(sent.length, 1, 'already at the bottom');
});

test('a busy channel gets one sticky repost after it goes quiet, or after the longest wait', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { guild, sent } = fakeGuild();
    stickies.push({ _id: 's0', guildId: GUILD, channelId: CHANNEL, content: 'Sticky', lastMessageId: null });
    const message = /** @type {any} */ ({
        inGuild: () => true,
        guildId: GUILD,
        channelId: CHANNEL,
        guild,
        author: { id: 'user' },
        client: { user: { id: 'bot' } },
    });
    const flush = async () => {
        for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
    };

    // A message every 3 seconds: it never goes quiet, so the longest wait applies
    for (let at = 0; at < STICKY_MAX_WAIT_MS; at += 3000) {
        await onMessage(message, at);
        t.mock.timers.tick(3000);
        await flush();
    }
    assert.equal(sent.length, 1, 'one repost, not one per message');

    // The bot's own messages don't trigger a repost
    await onMessage({ ...message, author: { id: 'bot' } }, STICKY_MAX_WAIT_MS * 2);
    t.mock.timers.tick(STICKY_QUIET_MS);
    await flush();
    assert.equal(sent.length, 1);
});

test('the dashboard checks auto messages before saving them', async () => {
    const { guild } = fakeGuild();
    const bad = await autoMessagesDashboard(
        guild,
        { op: 'saveAuto', message: { channelId: 'nope', content: '  ', intervalMinutes: 5 } },
        context
    );
    assert.equal(bad.ok, false);
    assert.equal(bad.details.length, 3, 'channel, message and interval');

    const good = await autoMessagesDashboard(
        guild,
        { op: 'saveAuto', message: { channelId: CHANNEL, content: 'Hello', intervalMinutes: 120 } },
        context
    );
    assert.ok(good.ok);
    assert.deepEqual(good.changes, ['#general, every 2 hours']);
    assert.equal(autos.length, 1);

    for (let i = 1; i < 10; i++) {
        await autoMessagesDashboard(
            guild,
            { op: 'saveAuto', message: { channelId: CHANNEL, content: 'x', intervalMinutes: 10 } },
            context
        );
    }
    const full = await autoMessagesDashboard(
        guild,
        { op: 'saveAuto', message: { channelId: CHANNEL, content: 'x', intervalMinutes: 10 } },
        context
    );
    assert.match(full.error, /at most 10/);
});

test('saving a sticky posts it straight away, and editing replaces the old copy', async () => {
    const { guild, sent, deleted } = fakeGuild();
    const first = await autoMessagesDashboard(
        guild,
        { op: 'saveSticky', message: { channelId: CHANNEL, content: 'Version 1' } },
        context
    );
    assert.ok(first.ok);
    assert.equal(first.action, 'Added a sticky message');
    assert.equal(sent[0].content, 'Version 1');

    const second = await autoMessagesDashboard(
        guild,
        { op: 'saveSticky', message: { channelId: CHANNEL, content: 'Version 2' } },
        context
    );
    assert.equal(second.action, 'Updated a sticky message');
    assert.deepEqual(deleted, ['m1']);
    assert.equal(sent[1].content, 'Version 2');
    assert.equal(stickies.length, 1, 'one per channel');
});
