import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { verificationDefaults } from '../src/features/verification/models/verification.js';
import Verification_Config_Cache from '../src/features/verification/cache/verificationConfig.cache.js';
import {
    makeCode,
    verifyBlocker,
    handleVerify,
    onJoin,
    removeUnverified,
    resetCodes,
} from '../src/features/verification/utils/verify.js';
import { validateVerificationSettings } from '../src/features/verification/utils/dashboard.js';

const GUILD = '400000000000000001';
const VERIFIED = '600000000000000001';
const UNVERIFIED = '600000000000000002';
const DAY = 86_400_000;

let config;
beforeEach(() => {
    resetCodes();
    config = {
        ...verificationDefaults(GUILD),
        enabled: true,
        channelId: 'c',
        roleId: VERIFIED,
        unverifiedRoleId: UNVERIFIED,
    };
    Verification_Config_Cache.get = /** @type {any} */ (async () => config);
});

function fakeGuild() {
    const roles = new Map([
        [VERIFIED, { id: VERIFIED, position: 1, managed: false }],
        [UNVERIFIED, { id: UNVERIFIED, position: 1, managed: false }],
    ]);
    return /** @type {any} */ ({
        id: GUILD,
        name: 'Test',
        preferredLocale: 'en-GB',
        memberCount: 10,
        roles: { cache: roles },
        members: {
            cache: new Map(),
            fetch: async () => {},
            me: { permissions: { has: () => true }, roles: { highest: { position: 10 } } },
        },
    });
}

function fakeMember(guild, id, { roles = [], ageDays = 365, joinedDaysAgo = 0, bot = false } = {}) {
    const cache = new Map(roles.map((role) => [role, {}]));
    const events = [];
    const member = {
        id,
        guild,
        kickable: true,
        joinedTimestamp: Date.now() - joinedDaysAgo * DAY,
        user: { id, bot, createdTimestamp: Date.now() - ageDays * DAY },
        roles: {
            cache,
            add: async (role) => (cache.set(role, {}), events.push(['add', role])),
            remove: async (role) => (cache.delete(role), events.push(['remove', role])),
        },
        send: async () => events.push(['dm']),
        kick: async () => events.push(['kick']),
    };
    guild.members.cache.set(id, member);
    return { member: /** @type {any} */ (member), events };
}

/** A click (or form) by this member. */
function interact(member, customId, extra = {}) {
    const replies = [];
    const interaction = {
        customId,
        guildId: GUILD,
        member,
        user: member.user,
        locale: 'en-GB',
        client: {
            utils: {
                Translate: (key, locale, vars) => `${key.split('.').pop()}${vars ? ` ${JSON.stringify(vars)}` : ''}`,
            },
        },
        isModalSubmit: () => false,
        reply: async (message) => replies.push(message),
        showModal: async (modal) => replies.push({ modal }),
        ...extra,
    };
    return { interaction: /** @type {any} */ (interaction), replies };
}

test('codes are 5 easy-to-read characters', () => {
    const code = makeCode();
    assert.match(code, /^[A-HJKMNP-Z2-9]{5}$/);
    assert.equal(
        makeCode(() => 0),
        'AAAAA'
    );
});

test('who can verify: on, not yet verified, a role Ovx can give, and an old enough account', () => {
    const guild = fakeGuild();
    const now = Date.now();
    assert.equal(verifyBlocker(fakeMember(guild, 'a').member, config, now), null);
    assert.equal(verifyBlocker(fakeMember(guild, 'b', { roles: [VERIFIED] }).member, config, now).key, 'already');
    assert.equal(verifyBlocker(fakeMember(guild, 'c').member, { ...config, enabled: false }, now).key, 'off');
    guild.roles.cache.get(VERIFIED).position = 20;
    assert.equal(verifyBlocker(fakeMember(guild, 'd').member, config, now).key, 'cannot_give');
    guild.roles.cache.get(VERIFIED).position = 1;
    const young = verifyBlocker(fakeMember(guild, 'e', { ageDays: 1 }).member, { ...config, minAccountDays: 7 }, now);
    assert.equal(young.key, 'too_new');
});

test('one click gives the verified role and takes the unverified one away', async () => {
    const { member, events } = fakeMember(fakeGuild(), 'a', { roles: [UNVERIFIED] });
    const { interaction, replies } = interact(member, 'vf:start');
    await handleVerify(interaction);
    assert.deepEqual(events, [
        ['add', VERIFIED],
        ['remove', UNVERIFIED],
    ]);
    assert.match(replies[0].content, /^done/);
});

test('with codes: the right code verifies, wrong ones count down, and too many start over', async () => {
    config.method = 'code';
    const { member, events } = fakeMember(fakeGuild(), 'a');

    const start = interact(member, 'vf:start');
    await handleVerify(start.interaction);
    // The test Translate shows the values as JSON: code_prompt {"code":"A B C D E"}
    const prompt = start.replies[0].content;
    const code = JSON.parse(prompt.slice(prompt.indexOf('{'))).code.replaceAll(' ', '');
    assert.equal(events.length, 0, 'not verified yet');

    const form = (typed) =>
        interact(member, 'vf:code', { isModalSubmit: () => true, fields: { getTextInputValue: () => typed } });
    const wrong = form('WRONG');
    await handleVerify(wrong.interaction);
    assert.match(wrong.replies[0].content, /^code_wrong/);

    const right = form(` ${code.toLowerCase()} `);
    await handleVerify(right.interaction);
    assert.match(right.replies[0].content, /^done/, 'spaces and case don’t matter');
    assert.deepEqual(events[0], ['add', VERIFIED]);
});

test('three wrong codes, or an old code, mean starting again', async () => {
    config.method = 'code';
    const { member } = fakeMember(fakeGuild(), 'a');
    await handleVerify(interact(member, 'vf:start').interaction);
    const form = () =>
        interact(member, 'vf:code', { isModalSubmit: () => true, fields: { getTextInputValue: () => 'NOPE1' } });
    await handleVerify(form().interaction);
    await handleVerify(form().interaction);
    const third = form();
    await handleVerify(third.interaction);
    assert.match(third.replies[0].content, /^code_too_many/);

    const late = form();
    await handleVerify(late.interaction);
    assert.match(late.replies[0].content, /^code_expired/);
});

test('new members get the unverified role', async () => {
    const { member, events } = fakeMember(fakeGuild(), 'a');
    await onJoin(member);
    assert.deepEqual(events, [['add', UNVERIFIED]]);
});

test('members who never verify are removed after the set time; verified, recent and bot members stay', async () => {
    config.kickAfterHours = 24;
    const guild = fakeGuild();
    const old = fakeMember(guild, 'old', { joinedDaysAgo: 2 });
    const verified = fakeMember(guild, 'verified', { joinedDaysAgo: 2, roles: [VERIFIED] });
    const recent = fakeMember(guild, 'recent', { joinedDaysAgo: 0 });
    const bot = fakeMember(guild, 'bot', { joinedDaysAgo: 2, bot: true });
    guild.members.cache = Object.assign(guild.members.cache, {
        filter(fn) {
            return new Map([...this].filter(([, value]) => fn(value)));
        },
    });

    const removed = await removeUnverified(/** @type {any} */ ({ guilds: { cache: new Map([[GUILD, guild]]) } }));
    assert.equal(removed, 1);
    assert.deepEqual(old.events, [['dm'], ['kick']]);
    for (const other of [verified, recent, bot]) assert.deepEqual(other.events, []);
});

test('settings: the roles must be ones Ovx can give, and a channel and role are needed to turn it on', () => {
    const guild = /** @type {any} */ ({
        textChannelIds: new Set(['c']),
        roles: new Map([
            [VERIFIED, { position: 1, managed: false }],
            ['high', { position: 50, managed: false }],
        ]),
        botHighestRolePosition: 10,
    });
    const good = { ...verificationDefaults(GUILD), enabled: true, channelId: 'c', roleId: VERIFIED };
    assert.deepEqual(validateVerificationSettings(good, guild).errors, []);
    assert.ok(
        validateVerificationSettings({ ...good, roleId: 'high' }, guild).errors.some((error) => /above Ovx/.test(error))
    );
    assert.ok(
        validateVerificationSettings({ ...good, roleId: null }, guild).errors.some((error) =>
            /before turning it on/.test(error)
        )
    );
    assert.ok(
        validateVerificationSettings({ ...good, unverifiedRoleId: VERIFIED }, guild).errors.some((error) =>
            /must be different/.test(error)
        )
    );
});
