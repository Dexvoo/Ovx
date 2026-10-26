import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { checkMessage } from '../src/features/honeypot/utils/honeypot.js';
import { validateHoneypotSettings, describeHoneypotChanges } from '../src/features/honeypot/utils/settings.js';
import { withHoneypotDefaults } from '../src/features/honeypot/models/honeypotConfig.js';
import Honeypot_Config_Cache from '../src/features/honeypot/cache/honeypotConfig.cache.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';
import { ModCase, ModCaseCounter } from '../src/features/moderation/models/modCase.js';
import { TempBan } from '../src/features/moderation/models/moderationTimers.js';
import { Translate } from '../src/shared/utils/i18n.js';

const GUILD = '400000000000000001';
const TRAP = '500000000000000001';
const GENERAL = '500000000000000002';
const MEMBER = '300000000000000001';

let config;
let cases;
beforeEach(() => {
    config = withHoneypotDefaults(GUILD, { enabled: true, channelId: TRAP });
    cases = [];
    Honeypot_Config_Cache.get = /** @type {any} */ (async () => config);
    Guild_Settings_Cache.get = /** @type {any} */ (async () => ({ embedColour: null }));
    ModCaseCounter.findOneAndUpdate = /** @type {any} */ (async () => ({ lastCase: cases.length + 1 }));
    ModCase.create = /** @type {any} */ (async (doc) => (cases.push(doc), doc));
    TempBan.deleteOne = /** @type {any} */ (async () => {});
});

/** A message from a member; returns what Ovx did about it. */
function fakeMessage({ channelId = TRAP, thread = null, canManage = false, bannable = true, bot = false } = {}) {
    const actions = { bans: [], unbans: [], dms: 0, deleted: false };
    const user = { id: MEMBER, username: 'spammer', send: async () => actions.dms++ };
    const guild = {
        id: GUILD,
        name: 'Test',
        preferredLocale: 'en-GB',
        client: { user: { id: 'bot', username: 'ovx' }, utils: { Translate } },
        bans: {
            create: async (id, options) => actions.bans.push({ id, ...options }),
            remove: async (id) => actions.unbans.push(id),
        },
    };
    const channel = {
        id: thread ? '500000000000000099' : channelId,
        parentId: thread,
        isThread: () => Boolean(thread),
        permissionsFor: () => ({ has: (flag) => flag === PermissionFlagsBits.ManageMessages && canManage }),
    };
    const message = {
        guild,
        channel,
        member: { id: MEMBER, user, bannable },
        author: { bot },
        webhookId: null,
        inGuild: () => true,
        delete: async () => {
            actions.deleted = true;
        },
    };
    return { message: /** @type {any} */ (message), actions };
}

test('posting in the honeypot channel bans the member, deletes their messages and records a case', async () => {
    const { message, actions } = fakeMessage();
    assert.equal(await checkMessage(message), true);
    assert.deepEqual(
        actions.bans.map(({ id, deleteMessageSeconds }) => [id, deleteMessageSeconds]),
        [[MEMBER, 3600]]
    );
    assert.deepEqual(actions.unbans, []);
    assert.equal(actions.dms, 1);
    assert.deepEqual(
        cases.map(({ action, moderatorId }) => [action, moderatorId]),
        [['ban', 'bot']]
    );
});

test('a softban unbans straight away and is recorded as a kick', async () => {
    config = { ...config, action: 'softban', notify: false };
    const { message, actions } = fakeMessage();
    assert.equal(await checkMessage(message), true);
    assert.deepEqual(actions.unbans, [MEMBER]);
    assert.equal(actions.dms, 0);
    assert.equal(cases[0].action, 'kick');
});

test("the honeypot message is still deleted when the ban doesn't delete messages", async () => {
    config = { ...config, deleteMessageSeconds: 0 };
    const { message, actions } = fakeMessage();
    await checkMessage(message);
    assert.equal(actions.deleted, true);
});

test('threads inside the honeypot channel count', async () => {
    const { message, actions } = fakeMessage({ thread: TRAP });
    assert.equal(await checkMessage(message), true);
    assert.equal(actions.bans.length, 1);
});

test('other channels, moderators, bots, members Ovx cannot ban and servers with it off are left alone', async () => {
    const cases = [
        ['another channel', fakeMessage({ channelId: GENERAL })],
        ['moderator', fakeMessage({ canManage: true })],
        ['bot', fakeMessage({ bot: true })],
        ['not bannable', fakeMessage({ bannable: false })],
    ];
    for (const [label, { message, actions }] of cases) {
        assert.equal(await checkMessage(message), false, label);
        assert.equal(actions.bans.length, 0, label);
    }

    config = withHoneypotDefaults(GUILD, { enabled: false, channelId: TRAP });
    assert.equal(await checkMessage(fakeMessage().message), false);
});

test('several messages at once only ban once', async () => {
    const first = fakeMessage();
    const second = fakeMessage();
    const results = await Promise.all([checkMessage(first.message), checkMessage(second.message)]);
    assert.deepEqual(results, [true, false]);
});

// ---------- Settings ----------

test('settings are checked and changes described for the Web Logs', () => {
    const guild = /** @type {any} */ ({ channelIds: new Set([TRAP]) });
    const good = { enabled: true, channelId: TRAP, action: 'softban', deleteMessageSeconds: 86400, notify: false };
    const { settings, errors } = validateHoneypotSettings(good, guild);
    assert.deepEqual(errors, []);
    assert.deepEqual(settings, good);

    assert.equal(
        validateHoneypotSettings({ ...good, action: 'kick', deleteMessageSeconds: 5, channelId: 'gone' }, guild).errors
            .length,
        3
    );
    assert.deepEqual(validateHoneypotSettings({ ...good, channelId: null }, guild).errors, [
        'Choose a honeypot channel before turning it on.',
    ]);

    const names = { channel: (id) => (id ? '#do-not-post' : 'none') };
    const before = withHoneypotDefaults(GUILD);
    assert.deepEqual(describeHoneypotChanges(before, { ...before, ...good }, names), [
        'Honeypot: off → on',
        'Channel: none → #do-not-post',
        'Action: ban → softban',
        'Delete their messages from the last: 1 hour → 1 day',
        'Tell the member why: on → off',
    ]);
});
