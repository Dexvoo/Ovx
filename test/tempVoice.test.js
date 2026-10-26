import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, Collection, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { TempChannel } from '../src/features/tempVoice/models/tempVoice.js';
import Temp_Voice_Config_Cache from '../src/features/tempVoice/cache/tempVoiceConfig.cache.js';
import { channelName, createFor, deleteIfEmpty, handleVoiceChange } from '../src/features/tempVoice/utils/channels.js';
import { handleControl, nextRenameAt, RENAME_WINDOW_MS } from '../src/features/tempVoice/utils/controls.js';
import { validateTempVoiceSettings } from '../src/features/tempVoice/utils/dashboard.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';

const GUILD = '400000000000000001';
const HUB = '510000000000000001';
const CATEGORY = '520000000000000001';
const hub = { channelId: HUB, categoryId: null, nameTemplate: "{user}'s channel", userLimit: 0 };

let records;
beforeEach(() => {
    records = new Map();
    Guild_Settings_Cache.get = /** @type {any} */ (async () => ({ embedColour: null }));
    Temp_Voice_Config_Cache.get = /** @type {any} */ (async () => ({ guildId: GUILD, enabled: true, hubs: [hub] }));
    const lean = (value) => ({ lean: async () => (value ? structuredClone(value) : null) });
    const find = (filter) =>
        [...records.values()].find((record) => Object.entries(filter).every(([key, value]) => record[key] === value));
    TempChannel.findOne = /** @type {any} */ ((filter) => lean(find(filter)));
    TempChannel.create = /** @type {any} */ (async (doc) => records.set(doc.channelId, { renames: [], ...doc }));
    TempChannel.deleteOne = /** @type {any} */ (async ({ channelId }) => records.delete(channelId));
    TempChannel.findOneAndDelete = /** @type {any} */ (
        ({ channelId }) => {
            const record = records.get(channelId);
            records.delete(channelId);
            return lean(record);
        }
    );
    TempChannel.findOneAndUpdate = /** @type {any} */ (
        ({ channelId }, { $set }) => {
            Object.assign(records.get(channelId), $set);
            return lean(records.get(channelId));
        }
    );
    TempChannel.updateOne = /** @type {any} */ (
        async ({ channelId }, { $set }) => Object.assign(records.get(channelId), $set)
    );
});

// ---------- A fake server ----------

function overwrites() {
    const cache = new Map();
    return {
        cache,
        edit: async (id, changes) => {
            const current = cache.get(id) ?? { id, allow: new PermissionsBitField(), deny: new PermissionsBitField() };
            for (const [name, value] of Object.entries(changes)) {
                const flag = PermissionFlagsBits[name];
                current.allow.remove(flag);
                current.deny.remove(flag);
                if (value === true) current.allow.add(flag);
                if (value === false) current.deny.add(flag);
            }
            cache.set(id, current);
        },
        delete: async (id) => cache.delete(id),
    };
}

function fakeServer() {
    const channels = new Map();
    const created = [];
    const deleted = [];
    const guild = {
        id: GUILD,
        name: 'Test',
        preferredLocale: 'en-GB',
        members: { me: { id: 'bot' } },
        channels: {
            cache: channels,
            create: async (options) => {
                const channel = voiceChannel(`new${created.length + 1}`, options.name);
                Object.assign(channel, { parentId: options.parent ?? null, userLimit: options.userLimit });
                channel.createOptions = options;
                created.push(channel);
                channels.set(channel.id, channel);
                return channel;
            },
        },
    };
    function voiceChannel(id, name) {
        const channel = {
            id,
            name,
            guild,
            type: ChannelType.GuildVoice,
            parentId: CATEGORY,
            userLimit: 0,
            members: new Collection(),
            permissionOverwrites: overwrites(),
            isVoiceBased: () => true,
            messages: { fetch: async () => ({ edit: async () => {} }) },
            send: async () => ({ id: 'panel' }),
            delete: async () => {
                deleted.push(id);
                channels.delete(id);
            },
            setName: async (value) => (channel.name = value),
            setUserLimit: async (value) => (channel.userLimit = value),
        };
        return channel;
    }
    const category = {
        id: CATEGORY,
        type: ChannelType.GuildCategory,
        permissionOverwrites: { cache: new Collection([['role1', { id: 'role1', type: 0, allow: 1n, deny: 0n }]]) },
    };
    channels.set(CATEGORY, category);
    channels.set(HUB, voiceChannel(HUB, '➕ Join to create'));
    return { guild, channels, created, deleted, voiceChannel };
}

function member(guild, id, { bot = false } = {}) {
    const m = {
        id,
        guild,
        displayName: `Name${id}`,
        user: { id, bot, username: `user${id}` },
        voice: {
            channelId: null,
            setChannel: async (channel) => {
                m.voice.channelId = channel.id;
                channel.members.set(id, m);
            },
            disconnect: async () => (m.voice.channelId = null),
        },
        permissionsIn: () => ({ has: () => false }),
        toString: () => `<@${id}>`,
    };
    return m;
}

// ---------- Making and removing channels ----------

test('the channel name comes from the template', () => {
    const someone = /** @type {any} */ ({ displayName: 'Sam', user: { username: 'sam_99' } });
    assert.equal(channelName("{user}'s channel", someone), "Sam's channel");
    assert.equal(channelName('🎮 {username}', someone), '🎮 sam_99');
    assert.equal(channelName('   ', someone), "Sam's channel");
});

test('joining a hub makes a channel with the category’s permissions and owner rights, and moves them in', async () => {
    const { guild, created } = fakeServer();
    const sam = member(guild, '1');
    await createFor(/** @type {any} */ (sam), hub);

    assert.equal(created.length, 1);
    const options = created[0].createOptions;
    assert.equal(options.name, "Name1's channel");
    assert.equal(options.parent, CATEGORY, "the hub's category");
    assert.ok(
        options.permissionOverwrites.some((overwrite) => overwrite.id === 'role1'),
        'inherits the category'
    );
    assert.ok(
        options.permissionOverwrites.some((overwrite) => overwrite.id === '1'),
        'owner rights'
    );
    assert.equal(sam.voice.channelId, 'new1');
    assert.equal(records.get('new1').ownerId, '1');
});

test('joining a hub again moves them back to their own channel instead of making another', async () => {
    const { guild, created } = fakeServer();
    const sam = member(guild, '1');
    await createFor(/** @type {any} */ (sam), hub);
    sam.voice.channelId = HUB;
    await createFor(/** @type {any} */ (sam), hub);
    assert.equal(created.length, 1);
    assert.equal(sam.voice.channelId, 'new1');
});

test('a channel is deleted once only bots are left, and hubs are never deleted', async () => {
    const { guild, deleted, channels } = fakeServer();
    const sam = member(guild, '1');
    await createFor(/** @type {any} */ (sam), hub);
    const channel = channels.get('new1');
    channel.members.set('music', member(guild, 'music', { bot: true }));

    channel.members.delete('1');
    await deleteIfEmpty(channel);
    assert.deepEqual(deleted, ['new1']);
    assert.equal(records.size, 0);

    await deleteIfEmpty(channels.get(HUB));
    assert.deepEqual(deleted, ['new1'], 'an empty hub stays');
});

test('voice changes: joining the hub makes a channel, leaving yours empty deletes it', async () => {
    const { guild, channels, deleted } = fakeServer();
    const sam = member(guild, '1');
    await handleVoiceChange(
        /** @type {any} */ ({ channelId: null, channel: null }),
        /** @type {any} */ ({ guild, channelId: HUB, member: sam })
    );
    assert.equal(sam.voice.channelId, 'new1');

    const channel = channels.get('new1');
    channel.members.delete('1');
    await handleVoiceChange(
        /** @type {any} */ ({ channelId: 'new1', channel }),
        /** @type {any} */ ({ guild, channelId: null, member: sam })
    );
    assert.deepEqual(deleted, ['new1']);
});

// ---------- The control panel ----------

async function ownedChannel() {
    const server = fakeServer();
    const owner = member(server.guild, '1');
    await createFor(/** @type {any} */ (owner), hub);
    const channel = server.channels.get('new1');
    return { ...server, owner, channel };
}

/** A click on the panel by this member. */
function click(channel, who, customId, extra = {}) {
    const replies = [];
    const interaction = {
        customId,
        channel,
        member: who,
        locale: 'en-GB',
        client: {
            utils: {
                Translate: (key, locale, vars) => `${key.split('.').pop()}${vars ? ` ${JSON.stringify(vars)}` : ''}`,
            },
        },
        isModalSubmit: () => false,
        isUserSelectMenu: () => false,
        reply: async (message) => replies.push(message),
        update: async (message) => replies.push(message),
        showModal: async (modal) => replies.push({ modal }),
        ...extra,
    };
    return { interaction: /** @type {any} */ (interaction), replies };
}

test('only the owner (or staff) can use the controls', async () => {
    const { channel, guild } = await ownedChannel();
    const stranger = member(guild, '2');
    const { interaction, replies } = click(channel, stranger, 'tv:lock');
    await handleControl(interaction);
    assert.match(replies[0].content, /^not_owner/);
});

test('lock and hide toggle @everyone, and unlocking brings back the category’s setting', async () => {
    const { channel, owner } = await ownedChannel();
    await handleControl(click(channel, owner, 'tv:lock').interaction);
    assert.ok(channel.permissionOverwrites.cache.get(GUILD).deny.has(PermissionFlagsBits.Connect));
    await handleControl(click(channel, owner, 'tv:lock').interaction);
    assert.ok(!channel.permissionOverwrites.cache.get(GUILD).deny.has(PermissionFlagsBits.Connect));
});

test('claiming only works once the owner has left', async () => {
    const { channel, guild, owner } = await ownedChannel();
    const pat = member(guild, '2');
    await pat.voice.setChannel(channel);

    const early = click(channel, pat, 'tv:claim');
    await handleControl(early.interaction);
    assert.match(early.replies[0].content, /^owner_here/);

    channel.members.delete(owner.id);
    const later = click(channel, pat, 'tv:claim');
    await handleControl(later.interaction);
    assert.match(later.replies[0].content, /^claimed/);
    assert.equal(records.get('new1').ownerId, '2');
});

test('kicking disconnects someone and keeps them out; the owner can’t be kicked', async () => {
    const { channel, guild, owner } = await ownedChannel();
    const pat = member(guild, '2');
    await pat.voice.setChannel(channel);
    const { interaction, replies } = click(channel, owner, 'tv:kick-select', {
        values: ['2'],
        isUserSelectMenu: () => true,
    });
    await handleControl(interaction);
    assert.match(replies[0].content, /^kicked/);
    assert.equal(pat.voice.channelId, null);
    assert.ok(channel.permissionOverwrites.cache.get('2').deny.has(PermissionFlagsBits.Connect));
});

test('renames are limited to Discord’s 2 every 10 minutes', async () => {
    const now = Date.now();
    assert.equal(nextRenameAt([], now), null);
    assert.equal(nextRenameAt([new Date(now - 1000)], now), null);
    assert.equal(nextRenameAt([new Date(now - 60_000), new Date(now - 1000)], now), now - 60_000 + RENAME_WINDOW_MS);
    assert.equal(
        nextRenameAt([new Date(now - RENAME_WINDOW_MS - 1), new Date(now - 1000)], now),
        null,
        'old renames don’t count'
    );

    const { channel, owner } = await ownedChannel();
    const form = (name) =>
        click(channel, owner, 'tv:rename-form', {
            isModalSubmit: () => true,
            fields: { getTextInputValue: () => name },
        });
    await handleControl(form('One').interaction);
    await handleControl(form('Two').interaction);
    const third = form('Three');
    await handleControl(third.interaction);
    assert.equal(channel.name, 'Two');
    assert.match(third.replies[0].content, /^rename_wait/);
});

// ---------- Settings ----------

test('settings: hubs must be voice channels, used once, with sensible limits', () => {
    const guild = { voiceChannelIds: new Set([HUB]), categoryIds: new Set([CATEGORY]) };
    assert.deepEqual(
        validateTempVoiceSettings(
            { enabled: true, hubs: [{ channelId: HUB, categoryId: CATEGORY, nameTemplate: '', userLimit: 5 }] },
            guild
        ).settings.hubs[0].nameTemplate,
        "{user}'s channel"
    );
    const { errors } = validateTempVoiceSettings(
        {
            enabled: true,
            hubs: [{ channelId: HUB, userLimit: 100 }, { channelId: HUB }, { channelId: 'text-channel' }],
        },
        guild
    );
    for (const expected of [/user limit/, /already used/, /choose a voice channel/]) {
        assert.ok(
            errors.some((error) => expected.test(error)),
            `expected ${expected}`
        );
    }
    assert.ok(
        validateTempVoiceSettings({ enabled: true, hubs: [] }, guild).errors.some((error) =>
            /before turning it on/.test(error)
        )
    );
});
