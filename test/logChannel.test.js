import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TextChannel, GuildMember, PermissionsBitField, PermissionFlagsBits } from 'discord.js';
import Logs_Cache from '../src/features/logging/cache/logs.cache.js';
import { getLogChannel, findAuditLogExecutor, findAuditLogEntry } from '../src/features/logging/utils/logChannel.js';

const ALL_NEEDED = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];

let config;
let disabled;

/** Builds a guild whose log channel and bot permissions can be controlled per test. */
function makeGuild({ channelExists = true, botPermissions = ALL_NEEDED, auditLog } = {}) {
    const guild = { id: 'g', name: 'Test Guild', channels: { cache: new Map() } };

    // Real prototypes so PermissionCheck's instanceof checks behave as in the bot
    const channel = Object.create(TextChannel.prototype);
    Object.assign(channel, { id: 'log', guild, messages: {} });
    if (channelExists) guild.channels.cache.set('log', channel);

    const me = Object.create(GuildMember.prototype);
    Object.defineProperty(me, 'permissions', { value: new PermissionsBitField(botPermissions) });
    me.permissionsIn = () => new PermissionsBitField(botPermissions);
    guild.members = { me };

    guild.fetchAuditLogs = auditLog ?? (async () => ({ entries: { find: () => undefined } }));
    return { guild, channel };
}

beforeEach(() => {
    config = { guildId: 'g', message: { enabled: true, channelId: 'log' }, ignoredChannels: ['ignored'] };
    disabled = [];
    Logs_Cache.get = async () => config;
    Logs_Cache.setType = async (guildId, type, data) => disabled.push({ type, data });
});

test('returns the log channel when everything is set up', async () => {
    const { guild, channel } = makeGuild();
    assert.equal(await getLogChannel(guild, 'message'), channel);
    assert.equal(disabled.length, 0);
});

test('returns null without disabling when the log type is not set up', async () => {
    const { guild } = makeGuild();
    assert.equal(await getLogChannel(guild, 'voice'), null);
    config.message.enabled = false;
    assert.equal(await getLogChannel(guild, 'message'), null);
    assert.equal(disabled.length, 0);
});

test('skips events from ignored channels', async () => {
    const { guild, channel } = makeGuild();
    assert.equal(await getLogChannel(guild, 'message', { sourceChannelId: 'ignored' }), null);
    assert.equal(await getLogChannel(guild, 'message', { sourceChannelId: 'other' }), channel);
    assert.equal(disabled.length, 0);
});

test('disables the log type when its channel is gone', async () => {
    const { guild } = makeGuild({ channelExists: false });
    assert.equal(await getLogChannel(guild, 'message'), null);
    assert.deepEqual(disabled, [{ type: 'message', data: { enabled: false, channelId: null } }]);
});

test('disables the log type when the bot cannot post in the channel', async () => {
    const { guild } = makeGuild({ botPermissions: [PermissionFlagsBits.ViewChannel] });
    assert.equal(await getLogChannel(guild, 'message'), null);
    assert.equal(disabled[0]?.type, 'message');
});

test('findAuditLogExecutor returns the matching entry executor', async () => {
    const moderator = { id: 'mod' };
    const entries = [
        { targetId: 'other', executor: { id: 'x' } },
        { targetId: 'target', executor: moderator },
    ];
    const { guild } = makeGuild({
        botPermissions: [...ALL_NEEDED, PermissionFlagsBits.ViewAuditLog],
        auditLog: async () => ({ entries: { find: (fn) => entries.find(fn) } }),
    });
    const executor = await findAuditLogExecutor(guild, 0, (e) => e.targetId === 'target', { delayMs: 0 });
    assert.equal(executor, moderator);
});

test('findAuditLogExecutor returns null without permission, without a match, or when the fetch fails', async () => {
    const noPermission = makeGuild().guild;
    assert.equal(await findAuditLogExecutor(noPermission, 0, () => true, { delayMs: 0 }), null);

    const withPermission = { botPermissions: [...ALL_NEEDED, PermissionFlagsBits.ViewAuditLog] };
    assert.equal(await findAuditLogExecutor(makeGuild(withPermission).guild, 0, () => false, { delayMs: 0 }), null);

    const failing = makeGuild({
        ...withPermission,
        auditLog: async () => {
            throw new Error('Missing Access');
        },
    }).guild;
    assert.equal(await findAuditLogExecutor(failing, 0, () => true, { delayMs: 0 }), null);
});

test('join and leave logs follow the member log settings until they are set up on their own', async () => {
    const { guild, channel } = makeGuild();
    config = { guildId: 'g', member: { enabled: true, channelId: 'log' } };
    assert.equal(await getLogChannel(guild, 'join'), channel);
    assert.equal(await getLogChannel(guild, 'leave'), channel);

    // Once set up (even turned off), they no longer follow member logs
    config.join = { enabled: false, channelId: null };
    assert.equal(await getLogChannel(guild, 'join'), null);
    assert.equal(await getLogChannel(guild, 'leave'), channel);

    // Other log types never borrow settings
    assert.equal(await getLogChannel(guild, 'server'), null);
});

test('listeners for the same event share one audit log fetch; other members get their own', async () => {
    let fetches = 0;
    const guild = {
        id: '400000000000000009',
        name: 'Test',
        members: { me: { permissions: { has: () => true } } },
        async fetchAuditLogs() {
            fetches++;
            return {
                entries: [
                    { targetId: 'a', reason: 'one' },
                    { targetId: 'b', reason: 'two' },
                ],
            };
        },
    };
    const lookup = (targetId) =>
        findAuditLogEntry(guild, 20, (entry) => entry.targetId === targetId, { delayMs: 0, targetId });

    const [logEntry, caseEntry] = await Promise.all([lookup('a'), lookup('a')]);
    assert.equal(fetches, 1, 'the log and the case recorder asked once between them');
    assert.equal(logEntry.reason, 'one');
    assert.equal(caseEntry, logEntry);

    assert.equal((await lookup('b')).reason, 'two');
    assert.equal(fetches, 2, 'a different member is looked up separately');
});

test('a later event for the same member gets a fresh fetch, made after its own entry was written', async () => {
    let fetches = 0;
    const guild = {
        id: '400000000000000010',
        name: 'Test',
        members: { me: { permissions: { has: () => true } } },
        async fetchAuditLogs() {
            fetches++;
            return { entries: [{ targetId: 'a', id: fetches }] };
        },
    };
    const lookup = () => findAuditLogEntry(guild, 20, (entry) => entry.targetId === 'a', { delayMs: 0, targetId: 'a' });

    const first = await lookup();
    const second = await lookup(); // e.g. kicked, rejoined and kicked again
    assert.equal(fetches, 2);
    assert.notEqual(first.id, second.id);
});
