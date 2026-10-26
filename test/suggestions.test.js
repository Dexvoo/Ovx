import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import {
    Suggestion,
    SuggestionCounter,
    SuggestionConfig,
    suggestionDefaults,
} from '../src/features/suggestions/models/suggestion.js';
import { createSuggestion, vote, decide, canDecide } from '../src/features/suggestions/utils/actions.js';
import { suggestionMessage, approval } from '../src/features/suggestions/utils/post.js';
import { validateSuggestionSettings } from '../src/features/suggestions/utils/dashboard.js';

const GUILD = '400000000000000001';
const CHANNEL = '500000000000000001';
const MANAGER = '600000000000000001';

let stored;
let config;
let counter;
beforeEach(() => {
    stored = [];
    counter = 0;
    config = {
        ...suggestionDefaults(GUILD),
        enabled: true,
        channelId: CHANNEL,
        cooldownMinutes: 5,
        managerRoleIds: [MANAGER],
    };
    let nextId = 1;
    const lean = (value) => ({ lean: async () => (value ? structuredClone(value) : null) });
    const matches = (doc, filter) =>
        Object.entries(filter).every(([key, value]) => {
            if (value && typeof value === 'object' && '$nin' in value) return !value.$nin.includes(doc[key]);
            return String(doc[key]) === String(value);
        });
    SuggestionConfig.findOne = /** @type {any} */ (() => lean(config));
    SuggestionCounter.findOneAndUpdate = /** @type {any} */ (() => lean({ last: ++counter }));
    Suggestion.create = /** @type {any} */ (
        async (doc) => {
            const created = {
                _id: String(nextId++).padStart(24, '0'),
                status: 'pending',
                upvoters: [],
                downvoters: [],
                messageId: null,
                ...doc,
            };
            stored.push(created);
            return { toObject: () => structuredClone(created) };
        }
    );
    Suggestion.findOne = /** @type {any} */ (
        (filter) => {
            const found = stored.filter((doc) => matches(doc, filter)).sort((a, b) => b.createdAt - a.createdAt)[0];
            return { ...lean(found), sort: () => lean(found) };
        }
    );
    Suggestion.findByIdAndUpdate = /** @type {any} */ (
        (id, { $set }) => {
            const doc = stored.find((item) => item._id === String(id));
            Object.assign(doc, $set);
            return lean(doc);
        }
    );
    Suggestion.findOneAndUpdate = /** @type {any} */ (
        (filter, update) => {
            const doc = stored.find((item) => matches(item, filter));
            if (!doc) return lean(null);
            Object.assign(doc, update.$set ?? {});
            for (const [key, value] of Object.entries(update.$addToSet ?? {}))
                if (!doc[key].includes(value)) doc[key].push(value);
            for (const [key, value] of Object.entries(update.$pull ?? {}))
                doc[key] = doc[key].filter((item) => item !== value);
            return lean(doc);
        }
    );
    Suggestion.deleteOne = /** @type {any} */ (async () => {});
});

function fakeGuild() {
    const sent = [];
    const dms = [];
    const threads = [];
    const channel = {
        id: CHANNEL,
        isTextBased: () => true,
        permissionsFor: () => ({ has: () => true }),
        send: async (message) => {
            sent.push(message);
            return {
                id: `70000000000000000${sent.length}`,
                startThread: async (options) => (threads.push(options), { id: 'thread1' }),
            };
        },
        messages: { fetch: async () => ({ edit: async (message) => sent.push({ edited: true, ...message }) }) },
    };
    const guild = {
        id: GUILD,
        name: 'Test',
        preferredLocale: 'en-GB',
        channels: { cache: new Map([[CHANNEL, channel]]) },
        members: { me: {}, cache: new Map() },
        client: { users: { fetch: async (id) => ({ id, send: async (message) => dms.push({ id, message }) }) } },
    };
    return { guild: /** @type {any} */ (guild), sent, dms, threads };
}

const member = (guild, id, { manager = false } = {}) =>
    /** @type {any} */ ({
        id,
        guild,
        permissions: { has: () => false },
        roles: { cache: new Map(manager ? [[MANAGER, {}]] : []) },
    });

test('a suggestion is numbered, posted with vote buttons, and gets a discussion thread', async () => {
    const { guild, sent, threads } = fakeGuild();
    const first = await createSuggestion(member(guild, 'a'), { content: '  Add a music channel  ' });
    const second = await createSuggestion(member(guild, 'b'), { content: 'More emojis' });

    assert.equal(first.suggestion.number, 1);
    assert.equal(second.suggestion.number, 2);
    assert.equal(first.suggestion.content, 'Add a music channel');
    assert.equal(first.suggestion.threadId, 'thread1');
    assert.equal(threads.length, 2);
    const [up, down] = sent[0].components[0].components;
    assert.equal(up.data.custom_id, `sg:up:${first.suggestion._id}`);
    assert.equal(down.data.label, '0');
});

test('suggestions need to be switched on, and members wait out the cooldown (managers don’t)', async () => {
    const { guild } = fakeGuild();
    const now = new Date();
    await createSuggestion(member(guild, 'a'), { content: 'One' }, now);
    const again = await createSuggestion(member(guild, 'a'), { content: 'Two' }, new Date(now.getTime() + 60_000));
    assert.equal(again.ok, false);
    assert.equal(again.error, 'cooldown');

    await createSuggestion(member(guild, 'm', { manager: true }), { content: 'One' }, now);
    assert.equal((await createSuggestion(member(guild, 'm', { manager: true }), { content: 'Two' }, now)).ok, true);

    config.enabled = false;
    assert.equal((await createSuggestion(member(guild, 'z'), { content: 'x' })).error, 'off');
});

test('voting: one vote each, clicking again takes it back, the other button switches it', async () => {
    const { guild } = fakeGuild();
    const { suggestion } = await createSuggestion(member(guild, 'a'), { content: 'Idea' });
    const id = String(suggestion._id);

    assert.equal((await vote(GUILD, id, 'u1', 'up')).vote, 'up');
    await vote(GUILD, id, 'u1', 'up');
    assert.deepEqual(stored[0].upvoters, [], 'clicking again takes it back');

    await vote(GUILD, id, 'u1', 'up');
    await vote(GUILD, id, 'u1', 'down');
    assert.deepEqual(stored[0].upvoters, []);
    assert.deepEqual(stored[0].downvoters, ['u1'], 'switched, never counted twice');

    assert.equal((await vote(GUILD, 'not-an-id', 'u1', 'up')).error, 'gone');
});

test('deciding updates the post, closes voting, and tells the author', async () => {
    const { guild, sent, dms } = fakeGuild();
    const { suggestion } = await createSuggestion(member(guild, 'author'), { content: 'Idea' });

    const result = await decide(guild, 1, 'approved', { reason: 'Great idea', decidedBy: 'staff' });
    assert.equal(result.ok, true);
    assert.equal(stored[0].status, 'approved');
    assert.equal(stored[0].reason, 'Great idea');
    const edited = sent.find((message) => message.edited);
    assert.ok(
        edited.components[0].components.every((button) => button.data.disabled),
        'voting closed'
    );
    assert.equal(dms[0].id, 'author');

    assert.equal((await vote(GUILD, String(suggestion._id), 'u1', 'up')).error, 'closed');
    assert.equal((await decide(guild, 99, 'denied', { decidedBy: 'staff' })).error, 'not_found');
    assert.equal((await decide(guild, 1, 'pending', { decidedBy: 'staff' })).error, 'bad_status');
});

test('the post shows the approval percentage', () => {
    assert.equal(approval(0, 0), null);
    assert.equal(approval(3, 1), 75);
    const { guild } = fakeGuild();
    const message = suggestionMessage(
        guild,
        /** @type {any} */ ({
            _id: 'x',
            number: 3,
            authorId: 'a',
            content: 'Idea',
            status: 'considering',
            upvoters: ['1', '2', '3'],
            downvoters: ['4'],
            createdAt: new Date(),
        })
    );
    const votes = message.embeds[0].data.fields.find((field) => field.name === 'Votes');
    assert.match(votes.value, /75% in favour/);
    assert.equal(message.components[0].components[0].data.disabled, false, 'still open while being considered');
});

test('Manage Server or a manager role can decide; settings are checked', () => {
    const admin = /** @type {any} */ ({
        permissions: { has: (flag) => flag === PermissionFlagsBits.ManageGuild },
        roles: { cache: new Map() },
    });
    assert.equal(canDecide(admin, config), true);
    assert.equal(canDecide(member(null, 'm', { manager: true }), config), true);
    assert.equal(canDecide(member(null, 'x'), config), false);

    const guild = /** @type {any} */ ({ textChannelIds: new Set([CHANNEL]), roles: new Map([[MANAGER, {}]]) });
    const good = {
        enabled: true,
        channelId: CHANNEL,
        threads: true,
        dmAuthor: false,
        cooldownMinutes: 10,
        managerRoleIds: [MANAGER],
    };
    assert.deepEqual(validateSuggestionSettings(good, guild).errors, []);
    assert.ok(
        validateSuggestionSettings({ ...good, channelId: null }, guild).errors.some((error) =>
            /before turning it on/.test(error)
        )
    );
    assert.ok(
        validateSuggestionSettings({ ...good, cooldownMinutes: 5000 }, guild).errors.some((error) =>
            /cooldown/.test(error)
        )
    );
});
