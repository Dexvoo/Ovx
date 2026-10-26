import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CustomMessage } from '../src/features/customEmbeds/models/customMessage.js';
import { validateCustomMessage, CUSTOM_EMBED_LIMITS } from '../src/features/customEmbeds/utils/validation.js';
import { customMessage } from '../src/features/customEmbeds/utils/message.js';
import { customEmbedsDashboard } from '../src/features/customEmbeds/utils/dashboard.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';

const GUILD = '400000000000000001';
const CHANNEL = '500000000000000001';
const OTHER = '500000000000000002';
const ID = 'b'.repeat(24);
const context = /** @type {any} */ ({
    textChannelIds: new Set([CHANNEL, OTHER]),
    channelIds: new Set([CHANNEL, OTHER]),
    roles: new Map(),
    botHighestRolePosition: 10,
    emojiIds: new Set(),
});

let stored;
beforeEach(() => {
    stored = [];
    Guild_Settings_Cache.get = /** @type {any} */ (async () => ({ embedColour: null }));
    const lean = (value) => ({ lean: async () => (value ? structuredClone(value) : null) });
    CustomMessage.findOne = /** @type {any} */ (({ _id }) => lean(stored.find((doc) => doc._id === _id)));
    CustomMessage.countDocuments = /** @type {any} */ (async () => stored.length);
    CustomMessage.create = /** @type {any} */ (
        async (doc) => {
            const created = { _id: ID, messageId: null, ...doc };
            stored.push(created);
            return { toObject: () => structuredClone(created) };
        }
    );
    CustomMessage.findByIdAndUpdate = /** @type {any} */ (
        (id, { $set }) => {
            const doc = stored.find((item) => item._id === id);
            Object.assign(doc, $set);
            return lean(doc);
        }
    );
    CustomMessage.deleteOne = /** @type {any} */ (
        async ({ _id }) => (stored = stored.filter((doc) => doc._id !== _id))
    );
});

const base = {
    name: 'Rules',
    channelId: CHANNEL,
    content: '',
    embed: { title: 'Rules', description: 'Be nice' },
    buttons: [],
};

test('a message with text or an embed is accepted, and links are tidied', () => {
    const { message, errors } = validateCustomMessage(
        {
            ...base,
            embed: { ...base.embed, url: ' https://ovxbot.com ', colour: '#B69CFF' },
            buttons: [{ label: 'Site', url: 'https://ovxbot.com' }],
        },
        context
    );
    assert.deepEqual(errors, []);
    assert.equal(message.embed.url, 'https://ovxbot.com/');
    assert.equal(message.embed.colour, '#b69cff');
    assert.equal(message.allowPings, false, 'pings are off unless chosen');
    assert.deepEqual(validateCustomMessage({ ...base, embed: {}, content: 'Just text' }, context).errors, []);
});

test('empty messages, bad links, incomplete fields and buttons are refused', () => {
    const { message, errors } = validateCustomMessage(
        {
            name: '',
            channelId: 'nope',
            embed: { imageUrl: 'javascript:alert(1)', fields: [{ name: 'Only a name' }] },
            buttons: [{ label: 'No link' }, { url: 'https://ok.example' }],
        },
        context
    );
    assert.equal(message, null);
    for (const expected of [
        /name/,
        /text channel/,
        /image must be a link/,
        /Field 1 needs/,
        /Button 1 needs a link/,
        /Button 2 needs a label/,
    ]) {
        assert.ok(
            errors.some((error) => expected.test(error)),
            `expected an error matching ${expected}`
        );
    }
    assert.match(validateCustomMessage({ ...base, embed: {} }, context).errors[0], /Add some message text/);
});

test("the embed's text together must fit Discord's 6000 limit", () => {
    const fields = Array.from({ length: 6 }, (_, i) => ({ name: `Field ${i}`, value: 'x'.repeat(1000) }));
    const { errors } = validateCustomMessage({ ...base, embed: { title: 'T', fields } }, context);
    assert.ok(errors.some((error) => /at most 6000/.test(error)));
    assert.equal(CUSTOM_EMBED_LIMITS.FIELDS_MAX, 25);
});

test('the Discord message has the embed, buttons, and pings only when allowed', async () => {
    const guild = /** @type {any} */ ({ id: GUILD });
    const { message: valid } = validateCustomMessage(
        {
            ...base,
            content: 'Hello <@&1>',
            embed: { title: 'Rules', fields: [{ name: 'One', value: 'Be nice', inline: true }], timestamp: true },
            buttons: [{ label: 'Site', url: 'https://ovxbot.com', emoji: '🌐' }],
        },
        context
    );
    const quiet = await customMessage(guild, valid);
    assert.equal(quiet.content, 'Hello <@&1>');
    assert.deepEqual(quiet.allowedMentions, { parse: [] });
    assert.equal(quiet.embeds[0].data.fields[0].inline, true);
    assert.ok(quiet.embeds[0].data.timestamp);
    assert.equal(quiet.components[0].components[0].data.url, 'https://ovxbot.com/');

    const loud = await customMessage(guild, { ...valid, allowPings: true });
    assert.deepEqual(loud.allowedMentions.parse, ['users', 'roles', 'everyone']);

    const textOnly = await customMessage(guild, { ...valid, embed: {}, buttons: [] });
    assert.deepEqual(textOnly.embeds, [], 'an empty embed is left out');
});

function fakeGuild() {
    const sent = [];
    const deleted = [];
    const channels = new Map(
        [CHANNEL, OTHER].map((id) => [
            id,
            {
                id,
                name: id === CHANNEL ? 'rules' : 'news',
                isTextBased: () => true,
                permissionsFor: () => ({ has: () => true }),
                send: async (message) => (
                    sent.push({ channelId: id, message }),
                    { id: `70000000000000000${sent.length}` }
                ),
                messages: {
                    fetch: async (messageId) => ({
                        edit: async (message) => sent.push({ edited: messageId, message }),
                    }),
                    delete: async (messageId) => deleted.push(messageId),
                },
            },
        ])
    );
    return {
        guild: /** @type {any} */ ({ id: GUILD, name: 'Test', channels: { cache: channels }, members: { me: {} } }),
        sent,
        deleted,
    };
}

test('saving posts, edits in place, moves channels, and deleting removes the message', async () => {
    const { guild, sent, deleted } = fakeGuild();

    const posted = await customEmbedsDashboard(guild, { op: 'save', message: base }, context);
    assert.ok(posted.ok);
    assert.equal(posted.action, 'Posted a custom message');
    assert.equal(stored[0].messageId, '700000000000000001');

    await customEmbedsDashboard(
        guild,
        { op: 'save', messageId: ID, message: { ...base, content: 'Updated' } },
        context
    );
    assert.equal(sent[1].edited, '700000000000000001');

    const moved = await customEmbedsDashboard(
        guild,
        { op: 'save', messageId: ID, message: { ...base, channelId: OTHER } },
        context
    );
    assert.equal(sent[2].channelId, OTHER);
    assert.deepEqual(deleted, ['700000000000000001']);
    assert.match(moved.changes[0], /moved from #rules/);

    const removed = await customEmbedsDashboard(guild, { op: 'delete', messageId: ID }, context);
    assert.equal(removed.action, 'Deleted a custom message');
    assert.equal(stored.length, 0);
    assert.equal((await customEmbedsDashboard(guild, { op: 'delete', messageId: '../etc' }, context)).ok, false);
});
