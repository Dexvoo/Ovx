import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { ReactionRolePanel, LegacyReactionRoles } from '../src/features/reactionRoles/models/reactionRolePanel.js';
import { validatePanel } from '../src/features/reactionRoles/utils/validation.js';
import { toggleRole } from '../src/features/reactionRoles/utils/assign.js';
import { legacySelect } from '../src/features/reactionRoles/utils/legacy.js';
import { panelMessage } from '../src/features/reactionRoles/utils/panel.js';
import { reactionRolesDashboard } from '../src/features/reactionRoles/utils/dashboard.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';

const GUILD = '400000000000000001';
const CHANNEL = '500000000000000001';
const OTHER_CHANNEL = '500000000000000002';
const PANEL_ID = 'a'.repeat(24);
const [RED, BLUE, GREEN, HIGH, MEMBER] = ['601', '602', '603', '604', '605'].map((n) => `${n}000000000000000`);

let stored;
let legacy;

beforeEach(() => {
    stored = [];
    legacy = [];
    Guild_Settings_Cache.get = /** @type {any} */ (async () => ({ embedColour: null }));
    const lean = (value) => ({ lean: async () => (value ? structuredClone(value) : null) });
    const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));

    ReactionRolePanel.findOne = /** @type {any} */ ((filter) => lean(stored.find((doc) => matches(doc, filter))));
    ReactionRolePanel.find = /** @type {any} */ (
        (filter) => ({ sort: () => lean(stored.filter((doc) => matches(doc, filter))) })
    );
    ReactionRolePanel.countDocuments = /** @type {any} */ (
        async (filter) => stored.filter((doc) => matches(doc, filter)).length
    );
    ReactionRolePanel.create = /** @type {any} */ (
        async (doc) => {
            const created = { _id: PANEL_ID, messageId: null, createdAt: new Date(), ...doc };
            stored.push(created);
            return { toObject: () => structuredClone(created) };
        }
    );
    ReactionRolePanel.findByIdAndUpdate = /** @type {any} */ (
        (id, { $set }) => {
            const doc = stored.find((item) => String(item._id) === String(id));
            if (doc) Object.assign(doc, $set);
            return lean(doc);
        }
    );
    ReactionRolePanel.deleteOne = /** @type {any} */ (
        async ({ _id }) => (stored = stored.filter((doc) => doc._id !== _id))
    );
    LegacyReactionRoles.findOne = /** @type {any} */ ((filter) => lean(legacy.find((doc) => matches(doc, filter))));
    LegacyReactionRoles.countDocuments = /** @type {any} */ (async () => legacy.length);
});

// ---------- Fakes ----------

function fakeGuild() {
    const roles = new Map(
        [
            [RED, 'Red', 1],
            [BLUE, 'Blue', 2],
            [GREEN, 'Green', 3],
            [HIGH, 'Admin', 20],
            [MEMBER, 'Member', 4],
        ].map(([id, name, position]) => [id, { id, name, position, managed: false, toString: () => `<@&${id}>` }])
    );
    const channels = new Map();
    const sent = [];
    const deleted = [];
    for (const id of [CHANNEL, OTHER_CHANNEL]) {
        channels.set(id, {
            id,
            name: id === CHANNEL ? 'roles' : 'other',
            isTextBased: () => true,
            permissionsFor: () => ({ has: () => true }),
            send: async (message) => (sent.push({ channelId: id, message }), { id: `70000000000000000${sent.length}` }),
            messages: {
                fetch: async (messageId) => ({ edit: async (message) => sent.push({ edited: messageId, message }) }),
                delete: async (messageId) => deleted.push(messageId),
            },
        });
    }
    const guild = {
        id: GUILD,
        name: 'Test',
        preferredLocale: 'en-GB',
        roles: { cache: roles },
        channels: { cache: channels },
        members: {
            me: {
                permissions: { has: (flag) => flag === PermissionFlagsBits.ManageRoles },
                roles: { highest: { position: 10 } },
            },
        },
    };
    return { guild: /** @type {any} */ (guild), sent, deleted };
}

/** A member holding these roles; adds and removes change them. */
function fakeMember(guild, held = []) {
    const cache = new Map(held.map((id) => [id, {}]));
    const ids = (roles) => (Array.isArray(roles) ? roles : [roles]).map((role) => role.id);
    return /** @type {any} */ ({
        guild,
        roles: {
            cache,
            add: async (roles) => ids(roles).forEach((id) => cache.set(id, {})),
            remove: async (roles) => ids(roles).forEach((id) => cache.delete(id)),
        },
    });
}

const savePanel = (overrides = {}) =>
    stored.push({
        _id: PANEL_ID,
        guildId: GUILD,
        channelId: CHANNEL,
        messageId: '700000000000000001',
        title: 'Colours',
        mode: 'normal',
        requiredRoleId: null,
        maxRoles: 0,
        buttons: [RED, BLUE, GREEN].map((roleId) => ({ roleId, label: null, emoji: null, style: 'secondary' })),
        ...overrides,
    });

const context = {
    textChannelIds: new Set([CHANNEL, OTHER_CHANNEL]),
    channelIds: new Set([CHANNEL, OTHER_CHANNEL]),
    roles: new Map([
        [RED, { position: 1, managed: false }],
        [BLUE, { position: 2, managed: false }],
        [HIGH, { position: 20, managed: false }],
        ['606000000000000000', { position: 3, managed: true }],
    ]),
    botHighestRolePosition: 10,
    emojiIds: new Set(),
};

// ---------- Validation ----------

test('a valid panel is accepted, with roles in order', () => {
    const { panel, errors } = validatePanel(
        {
            title: ' Colours ',
            channelId: CHANNEL,
            mode: 'unique',
            maxRoles: 3,
            buttons: [
                { roleId: RED, label: 'Red', emoji: '🔴', style: 'danger' },
                { roleId: BLUE, style: 'nonsense' },
            ],
        },
        context
    );
    assert.deepEqual(errors, []);
    assert.equal(panel.title, 'Colours');
    assert.equal(panel.maxRoles, 0, 'the limit only applies in normal mode');
    assert.deepEqual(panel.buttons[1], { roleId: BLUE, label: null, emoji: null, style: 'secondary' });
});

test('roles Ovx cannot give, duplicates and bad emojis are refused', () => {
    const { panel, errors } = validatePanel(
        {
            title: '',
            channelId: 'nope',
            mode: 'party',
            buttons: [
                { roleId: HIGH },
                { roleId: '606000000000000000' },
                { roleId: RED, emoji: 'not an emoji' },
                { roleId: RED },
                { roleId: 'missing' },
            ],
        },
        context
    );
    assert.equal(panel, null);
    for (const expected of [
        /title/,
        /text channel/,
        /how the panel works/,
        /above Ovx/,
        /managed/,
        /emoji/,
        /already on this panel/,
        /choose a role/,
    ]) {
        assert.ok(
            errors.some((error) => expected.test(error)),
            `expected an error matching ${expected}`
        );
    }
    assert.match(
        validatePanel({ title: 'x', channelId: CHANNEL, mode: 'normal', buttons: [] }, context).errors[0],
        /at least one role/
    );
});

// ---------- Clicking ----------

test('normal mode: click to get a role, click again to remove it', async () => {
    const { guild } = fakeGuild();
    savePanel();
    const member = fakeMember(guild);

    assert.equal((await toggleRole(member, PANEL_ID, RED)).key, 'added');
    assert.ok(member.roles.cache.has(RED));
    assert.equal((await toggleRole(member, PANEL_ID, RED)).key, 'removed');
    assert.ok(!member.roles.cache.has(RED));
});

test('normal mode with a limit stops at the most roles allowed', async () => {
    const { guild } = fakeGuild();
    savePanel({ maxRoles: 2 });
    const member = fakeMember(guild, [RED, BLUE]);
    const outcome = await toggleRole(member, PANEL_ID, GREEN);
    assert.deepEqual(outcome, { key: 'max', vars: { count: 2 } });
    assert.ok(!member.roles.cache.has(GREEN));
});

test('only one mode swaps the role for the new one', async () => {
    const { guild } = fakeGuild();
    savePanel({ mode: 'unique' });
    const member = fakeMember(guild, [RED, MEMBER]);
    const outcome = await toggleRole(member, PANEL_ID, BLUE);
    assert.equal(outcome.key, 'swapped');
    assert.deepEqual([...member.roles.cache.keys()].sort(), [BLUE, MEMBER].sort(), 'roles from other places are kept');
});

test('add only mode never removes a role', async () => {
    const { guild } = fakeGuild();
    savePanel({ mode: 'verify' });
    const member = fakeMember(guild, [RED]);
    assert.equal((await toggleRole(member, PANEL_ID, RED)).key, 'already');
    assert.ok(member.roles.cache.has(RED));
});

test('a required role is needed to use the panel', async () => {
    const { guild } = fakeGuild();
    savePanel({ requiredRoleId: MEMBER });
    assert.equal((await toggleRole(fakeMember(guild), PANEL_ID, RED)).key, 'need_role');
    assert.equal((await toggleRole(fakeMember(guild, [MEMBER]), PANEL_ID, RED)).key, 'added');
});

test('deleted panels, roles not on the panel, and roles above Ovx are handled', async () => {
    const { guild } = fakeGuild();
    assert.equal((await toggleRole(fakeMember(guild), PANEL_ID, RED)).key, 'gone');
    assert.equal((await toggleRole(fakeMember(guild), 'bad', RED)).key, 'gone');
    savePanel({ buttons: [{ roleId: HIGH, style: 'secondary' }] });
    assert.equal((await toggleRole(fakeMember(guild), PANEL_ID, RED)).key, 'gone');
    assert.equal((await toggleRole(fakeMember(guild), PANEL_ID, HIGH)).key, 'cannot_give');
});

test('dropdowns from the old Ovx still give and remove roles', async () => {
    const { guild } = fakeGuild();
    legacy.push({ guildId: GUILD, messageId: '123', roles: [{ roleId: RED }, { roleId: BLUE }] });
    const member = fakeMember(guild, [RED]);
    const outcome = await legacySelect(
        /** @type {any} */ ({ guild, member, values: [BLUE], customId: 'select-role.123' })
    );
    assert.equal(outcome.key, 'updated');
    assert.deepEqual([...member.roles.cache.keys()], [BLUE]);
});

// ---------- Posting ----------

test('the panel message has a button per role, five to a row', async () => {
    const { guild } = fakeGuild();
    const buttons = Array.from({ length: 7 }, () => ({ roleId: RED, label: null, emoji: null, style: 'primary' }));
    const message = await panelMessage(
        guild,
        /** @type {any} */ ({ _id: PANEL_ID, title: 'T', mode: 'unique', maxRoles: 0, buttons })
    );
    assert.deepEqual(
        message.components.map((row) => row.components.length),
        [5, 2]
    );
    const first = message.components[0].components[0].data;
    assert.equal(first.custom_id, `rr:${PANEL_ID}:${RED}`);
    assert.equal(first.label, 'Red', 'an empty label uses the role name');
    assert.match(message.embeds[0].data.footer.text, /one of these roles/);
});

test('saving posts a new panel, edits it in place, and moves it when the channel changes', async () => {
    const { guild, sent, deleted } = fakeGuild();
    const input = { title: 'Colours', channelId: CHANNEL, mode: 'normal', buttons: [{ roleId: RED }] };

    const created = await reactionRolesDashboard(guild, { op: 'save', panel: input }, context);
    assert.ok(created.ok);
    assert.equal(created.action, 'Created a reaction role panel');
    assert.equal(sent.length, 1);
    assert.equal(stored[0].messageId, '700000000000000001');

    await reactionRolesDashboard(
        guild,
        { op: 'save', panelId: PANEL_ID, panel: { ...input, title: 'Pick a colour' } },
        context
    );
    assert.equal(sent[1].edited, '700000000000000001', 'same channel: the message is edited');

    const moved = await reactionRolesDashboard(
        guild,
        { op: 'save', panelId: PANEL_ID, panel: { ...input, channelId: OTHER_CHANNEL } },
        context
    );
    assert.equal(sent[2].channelId, OTHER_CHANNEL);
    assert.deepEqual(deleted, ['700000000000000001'], 'the old message is removed');
    assert.ok(moved.changes.some((change) => /Channel: #roles → #other/.test(change)));

    const removed = await reactionRolesDashboard(guild, { op: 'delete', panelId: PANEL_ID }, context);
    assert.equal(removed.action, 'Deleted a reaction role panel');
    assert.equal(stored.length, 0);
});
