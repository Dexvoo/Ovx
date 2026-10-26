import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { StarboardPost } from '../src/features/starboard/models/starboard.js';
import Starboard_Config_Cache, { starboardDefaults } from '../src/features/starboard/cache/starboardConfig.cache.js';
import {
    isStarEmoji,
    countEmoji,
    starboardBlocker,
    countStars,
    updateStarboard,
    handleDeletedMessage,
} from '../src/features/starboard/utils/starboard.js';
import { validateStarboardSettings, describeStarboardChanges } from '../src/features/starboard/utils/settings.js';

const GUILD = '400000000000000001';
const GENERAL = '500000000000000001';
const STARBOARD = '500000000000000002';
const AUTHOR = '300000000000000001';

let config;
let posts;
beforeEach(() => {
    config = { ...starboardDefaults(GUILD), enabled: true, channelId: STARBOARD, threshold: 2 };
    posts = new Map();
    Starboard_Config_Cache.get = /** @type {any} */ (async () => config);
    const lean = (value) => ({ lean: async () => (value ? structuredClone(value) : null) });
    StarboardPost.findOne = /** @type {any} */ (
        (filter) =>
            lean(
                filter.messageId
                    ? posts.get(filter.messageId)
                    : [...posts.values()].find((post) => post.starboardMessageId === filter.starboardMessageId)
            )
    );
    StarboardPost.updateOne = /** @type {any} */ (
        async (filter, { $set }) => {
            const key =
                filter.messageId ??
                [...posts.values()].find((post) => post.starboardMessageId === filter.starboardMessageId)?.messageId;
            if (!key) return;
            posts.set(key, { messageId: key, removed: false, ...posts.get(key), ...$set });
        }
    );
    StarboardPost.deleteOne = /** @type {any} */ (async ({ messageId }) => posts.delete(messageId));
});

// ---------- Fakes ----------

function fakeGuild() {
    const sent = [];
    const edits = [];
    const deleted = [];
    const channel = (id, name, nsfw = false) => ({
        id,
        name,
        nsfw,
        isThread: () => false,
        isTextBased: () => true,
        permissionsFor: () => ({ has: () => true }),
        toString: () => `<#${id}>`,
        send: async (message) => (sent.push(message), { id: `90000000000000000${sent.length}` }),
        messages: {
            fetch: async (id) => ({ edit: async (message) => edits.push({ id, message }) }),
            delete: async (id) => deleted.push(id),
        },
    });
    const channels = new Map([
        [GENERAL, channel(GENERAL, 'general')],
        [STARBOARD, channel(STARBOARD, 'starboard')],
        ['nsfw', channel('nsfw', 'spicy', true)],
    ]);
    const guild = {
        id: GUILD,
        name: 'Test',
        preferredLocale: 'en-GB',
        channels: { cache: channels },
        members: { me: {} },
    };
    return { guild, channels, sent, edits, deleted };
}

/** A message whose ⭐ reaction is from these users. */
function fakeMessage(guild, reactors, { channelId = GENERAL, bot = false, id = '800000000000000001' } = {}) {
    const users = new Map(reactors.map((userId) => [userId, { id: userId, bot: userId.startsWith('bot') }]));
    const reaction = {
        emoji: { id: null, name: '⭐️' },
        get count() {
            return users.size;
        },
        users: {
            fetch: async () =>
                Object.assign(new Map(users), { filter: (fn) => ({ size: [...users.values()].filter(fn).length }) }),
        },
    };
    const message = {
        id,
        guild,
        guildId: GUILD,
        channel: guild.channels.cache.get(channelId),
        author: { id: AUTHOR, bot, displayName: 'Author', displayAvatarURL: () => 'https://cdn.discordapp.com/a.png' },
        member: null,
        content: 'A great message',
        embeds: [],
        attachments: Object.assign(new Map(), { find: () => undefined, filter: () => ({ size: 0, map: () => [] }) }),
        reference: null,
        system: false,
        partial: false,
        url: `https://discord.com/channels/${GUILD}/${channelId}/${id}`,
        createdAt: new Date(),
        inGuild: () => true,
        reactions: { cache: { find: (fn) => (fn(reaction) ? reaction : undefined) } },
    };
    return { message: /** @type {any} */ (message), users };
}

// ---------- Rules ----------

test('the star emoji matches with or without the invisible variation selector, and custom emojis by ID', () => {
    assert.equal(isStarEmoji({ id: null, name: '⭐️' }, '⭐'), true);
    assert.equal(isStarEmoji({ id: null, name: '⭐' }, '⭐️'), true);
    assert.equal(isStarEmoji({ id: null, name: '👍' }, '⭐'), false);
    assert.equal(isStarEmoji({ id: '123', name: 'star' }, '<:star:123>'), true);
    assert.equal(isStarEmoji({ id: '999', name: 'star' }, '<:star:123>'), false);
});

test('the default star grows with popularity; a custom emoji stays as chosen', () => {
    assert.deepEqual(
        [1, 5, 10, 25].map((stars) => countEmoji('⭐', stars)),
        ['⭐', '🌟', '💫', '✨']
    );
    assert.equal(countEmoji('🔥', 50), '🔥');
});

test('starboard posts, ignored channels, bots and age-restricted messages are skipped', () => {
    const { guild } = fakeGuild();
    const blocker = (options, overrides = {}) =>
        starboardBlocker(fakeMessage(guild, [], options).message, { ...config, ...overrides });
    assert.equal(blocker({}), null);
    assert.equal(blocker({ channelId: STARBOARD }), 'starboard');
    assert.equal(blocker({}, { ignoredChannelIds: [GENERAL] }), 'ignored');
    assert.equal(blocker({ bot: true }), 'bot');
    assert.equal(blocker({ bot: true }, { allowBots: true }), null);
    assert.equal(blocker({ channelId: 'nsfw' }), 'nsfw');
    assert.equal(blocker({}, { enabled: false }), 'off');
});

test("bots and the author's own star don't count, unless self-stars are on", async () => {
    const { guild } = fakeGuild();
    const { message } = fakeMessage(guild, ['u1', 'u2', AUTHOR, 'bot1']);
    assert.equal(await countStars(message, config), 2);
    assert.equal(await countStars(message, { ...config, selfStar: true }), 3);
});

// ---------- Posting ----------

test('posted when it reaches the stars needed, then the count is kept up to date', async () => {
    const { guild, sent, edits } = fakeGuild();
    const { message, users } = fakeMessage(guild, ['u1']);

    await updateStarboard(message);
    assert.equal(sent.length, 0, 'one star is not enough');

    users.set('u2', { id: 'u2', bot: false });
    await updateStarboard(message);
    assert.equal(sent.length, 1);
    assert.match(sent[0].content, /^⭐ \*\*2\*\* \| <#/);
    assert.equal(sent[0].embeds[0].data.description, 'A great message');
    assert.equal(sent[0].components[0].components[0].data.url, message.url);
    assert.equal(posts.get(message.id).stars, 2);

    users.set('u3', { id: 'u3', bot: false });
    await updateStarboard(message);
    assert.equal(sent.length, 1, 'not posted twice');
    assert.match(edits[0].message.content, /\*\*3\*\*/);
});

test('a burst of stars at once still posts only once', async () => {
    const { guild, sent } = fakeGuild();
    const { message } = fakeMessage(guild, ['u1', 'u2', 'u3']);
    await Promise.all([updateStarboard(message), updateStarboard(message), updateStarboard(message)]);
    assert.equal(sent.length, 1);
});

test('taken down when stars drop below the number needed (if set), and can come back', async () => {
    const { guild, sent, deleted } = fakeGuild();
    const { message, users } = fakeMessage(guild, ['u1', 'u2']);
    await updateStarboard(message);
    users.delete('u2');
    await updateStarboard(message);
    assert.deepEqual(deleted, ['900000000000000001']);
    assert.equal(posts.has(message.id), false);

    users.set('u2', { id: 'u2', bot: false });
    await updateStarboard(message);
    assert.equal(sent.length, 2, 'posted again once it has enough stars');
});

test('a starboard post a moderator deleted is not posted again', async () => {
    const { guild, sent } = fakeGuild();
    const { message, users } = fakeMessage(guild, ['u1', 'u2']);
    await updateStarboard(message);

    await handleDeletedMessage(/** @type {any} */ ({ id: '900000000000000001', guildId: GUILD, guild }));
    assert.equal(posts.get(message.id).removed, true);

    users.set('u3', { id: 'u3', bot: false });
    await updateStarboard(message);
    assert.equal(sent.length, 1);
});

test('deleting a starred message removes its starboard post', async () => {
    const { guild, deleted } = fakeGuild();
    const { message } = fakeMessage(guild, ['u1', 'u2']);
    await updateStarboard(message);
    await handleDeletedMessage(message);
    assert.deepEqual(deleted, ['900000000000000001']);
    assert.equal(posts.size, 0);
});

// ---------- Settings ----------

test('settings: a channel is needed to turn it on, and changes are described', () => {
    const guild = /** @type {any} */ ({
        textChannelIds: new Set([STARBOARD]),
        channelIds: new Set([STARBOARD, GENERAL]),
        emojiIds: new Set(),
    });
    const good = {
        enabled: true,
        channelId: STARBOARD,
        emoji: '⭐',
        threshold: 5,
        selfStar: false,
        allowBots: false,
        removeBelow: true,
        ignoredChannelIds: [GENERAL],
    };
    assert.deepEqual(validateStarboardSettings(good, guild).errors, []);
    assert.ok(
        validateStarboardSettings({ ...good, channelId: null }, guild).errors.some((error) =>
            /channel before/.test(error)
        )
    );
    assert.equal(validateStarboardSettings({ ...good, threshold: 0, emoji: 'star' }, guild).errors.length, 2);

    const names = { channel: (id) => (id ? '#starboard' : 'none') };
    const before = { ...good, enabled: false, channelId: null, threshold: 3, ignoredChannelIds: [] };
    assert.deepEqual(describeStarboardChanges(before, good, names), [
        'Starboard: off → on',
        'Channel: none → #starboard',
        'Stars needed: 3 → 5',
        'Added ignored channel: #starboard',
    ]);
});
