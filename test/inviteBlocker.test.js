import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { findInvites, normalise, hasBlockedInvite } from '../src/features/inviteBlocker/utils/detect.js';
import { checkMessage } from '../src/features/inviteBlocker/utils/blocker.js';
import { validateInviteSettings, describeInviteChanges } from '../src/features/inviteBlocker/utils/settings.js';
import { withInviteDefaults } from '../src/features/inviteBlocker/models/inviteConfig.js';
import Invite_Config_Cache from '../src/features/inviteBlocker/cache/inviteConfig.cache.js';
import { formatLinks, memberImageUrl } from '../src/features/utility/utils/profileImages.js';

const GUILD = '400000000000000001';
const OTHER_GUILD = '400000000000000009';
const CHANNEL = '500000000000000001';
const ROLE = '600000000000000001';

let config;
beforeEach(() => {
    config = withInviteDefaults(GUILD, { enabled: true });
    Invite_Config_Cache.get = /** @type {any} */ (async () => config);
});

// ---------- Finding invites ----------

test('invite links are found, including disguised ones', () => {
    const codes = (text) => findInvites(text).codes;
    assert.deepEqual(codes('join discord.gg/abc123 now'), ['abc123']);
    assert.deepEqual(codes('https://discord.com/invite/Cool-Server'), ['Cool-Server']);
    assert.deepEqual(codes('https://canary.discordapp.com/invite/xyz'), ['xyz']);
    assert.deepEqual(codes('discord . gg / spaced'), ['spaced']);
    assert.deepEqual(codes('discord\\.gg/escaped'), ['escaped']);
    assert.deepEqual(codes(`discord${String.fromCharCode(0x200b)}.gg/hidden`), ['hidden']);
    assert.deepEqual(codes('discord.gg/a1 and discord.gg/a1 again'), ['a1']);
    assert.equal(findInvites('come to dsc.gg/myserver').other, true);
});

test('normal text and other Discord links are not invites', () => {
    for (const text of [
        'I love discord',
        'see https://discord.com/channels/1/2/3',
        'support.discord.com/hc',
        'the end. Good game',
        '',
    ]) {
        const result = findInvites(text);
        assert.deepEqual(result, { codes: [], other: false }, text);
    }
    assert.equal(normalise('a . b / c'), 'a.b/c');
});

function fakeGuild({ vanity = null, invites = {} } = {}) {
    let lookups = 0;
    const guild = {
        id: GUILD,
        name: 'Test',
        preferredLocale: 'en-GB',
        vanityURLCode: vanity,
        client: {
            fetchInvite: async (code) => {
                lookups++;
                if (!(code in invites)) throw new Error('Unknown Invite');
                return { guild: { id: invites[code] } };
            },
        },
    };
    return { guild: /** @type {any} */ (guild), lookups: () => lookups };
}

test("invites to this server are allowed when that's switched on, and others are not", async () => {
    const { guild, lookups } = fakeGuild({ vanity: 'mine', invites: { own1: GUILD, theirs: OTHER_GUILD } });
    assert.equal(await hasBlockedInvite(guild, 'discord.gg/mine', true), false);
    assert.equal(await hasBlockedInvite(guild, 'discord.gg/own1', true), false);
    assert.equal(await hasBlockedInvite(guild, 'discord.gg/own1 discord.gg/theirs', true), true);
    assert.equal(await hasBlockedInvite(guild, 'discord.gg/expired1', true), true, 'unknown invites are blocked');
    assert.equal(await hasBlockedInvite(guild, 'discord.gg/own1', false), true, 'all invites when not allowed');
    assert.equal(await hasBlockedInvite(guild, 'dsc.gg/anything', true), true);

    const before = lookups();
    await hasBlockedInvite(guild, 'discord.gg/own1', true);
    assert.equal(lookups(), before, 'each code is only looked up once');
});

// ---------- Handling messages ----------

/** A message from a member; returns what Ovx did with it. */
function fakeMessage(content, { roles = [], canManage = false, botCanDelete = true, bot = false, thread = null } = {}) {
    const actions = { deleted: false, notices: [] };
    const { guild } = fakeGuild();
    const member = {
        id: '300000000000000001',
        roles: { cache: new Map(roles.map((id) => [id, {}])) },
        toString: () => '<@300>',
    };
    const me = { id: 'bot' };
    guild.members = { me };
    const channel = {
        id: CHANNEL,
        name: 'general',
        parentId: thread,
        isThread: () => Boolean(thread),
        permissionsFor: (who) => ({
            has: (flag) => flag === PermissionFlagsBits.ManageMessages && (who === me ? botCanDelete : canManage),
        }),
        send: async (message) => (actions.notices.push(message.content), { delete: async () => {} }),
    };
    const message = {
        content,
        guild,
        channel,
        member,
        author: { bot },
        webhookId: null,
        inGuild: () => true,
        delete: async () => {
            actions.deleted = true;
        },
    };
    return { message: /** @type {any} */ (message), actions };
}

test('a message with an invite is deleted and the member is told', async () => {
    const { message, actions } = fakeMessage('free nitro discord.gg/scam', {});
    assert.equal(await checkMessage(message, 1_000_000), true);
    assert.equal(actions.deleted, true);
    assert.equal(actions.notices.length, 1);
    assert.match(actions.notices[0], /not allowed/);
});

test('moderators, allowed roles, ignored channels, bots and servers with it off are left alone', async () => {
    const cases = [
        ['moderator', fakeMessage('discord.gg/x1', { canManage: true })],
        ['allowed role', ((config.ignoredRoleIds = [ROLE]), fakeMessage('discord.gg/x1', { roles: [ROLE] }))],
        ['bot', fakeMessage('discord.gg/x1', { bot: true })],
        [
            'thread in an ignored channel',
            ((config.ignoredChannelIds = ['ignored']), fakeMessage('discord.gg/x1', { thread: 'ignored' })),
        ],
        ['no Manage Messages for Ovx', fakeMessage('discord.gg/x1', { botCanDelete: false })],
    ];
    for (const [label, { message, actions }] of cases) {
        assert.equal(await checkMessage(message), false, label);
        assert.equal(actions.deleted, false, label);
    }

    config = withInviteDefaults(GUILD, { enabled: false });
    const off = fakeMessage('discord.gg/x1');
    assert.equal(await checkMessage(off.message), false);
});

test('several invites in a row get one notice, not one each', async () => {
    const first = fakeMessage('discord.gg/one1');
    const second = fakeMessage('discord.gg/two2');
    await checkMessage(first.message, 5_000_000);
    await checkMessage(second.message, 5_000_000 + 2000);
    assert.equal(second.actions.deleted, true);
    assert.equal(second.actions.notices.length, 0);
});

// ---------- Settings ----------

test('settings are checked and changes described for the Web Logs', () => {
    const guild = /** @type {any} */ ({ channelIds: new Set([CHANNEL]), roles: new Map([[ROLE, {}]]) });
    const good = {
        enabled: true,
        allowOwnInvites: false,
        notify: true,
        warn: true,
        ignoredChannelIds: [CHANNEL, CHANNEL],
        ignoredRoleIds: [ROLE],
    };
    const { settings, errors } = validateInviteSettings(good, guild);
    assert.deepEqual(errors, []);
    assert.deepEqual(settings.ignoredChannelIds, [CHANNEL]);

    assert.equal(validateInviteSettings({ ...good, enabled: 'yes', ignoredRoleIds: ['gone'] }, guild).errors.length, 2);

    const names = { channel: () => '#partners', role: () => '@Staff' };
    const before = { ...withInviteDefaults(GUILD), ignoredChannelIds: [], ignoredRoleIds: [] };
    assert.deepEqual(describeInviteChanges(before, { ...before, enabled: true, ignoredChannelIds: [CHANNEL] }, names), [
        'Invite blocker: off → on',
        'Added ignored channel: #partners',
    ]);
});

test('old settings documents, which only had enabled, get the new defaults', () => {
    assert.deepEqual(withInviteDefaults(GUILD, { enabled: true }), {
        guildId: GUILD,
        enabled: true,
        allowOwnInvites: true,
        notify: true,
        warn: false,
        ignoredChannelIds: [],
        ignoredRoleIds: [],
    });
});

// ---------- Avatars and banners ----------

test('avatar links come in every format, at full size', () => {
    assert.deepEqual(
        formatLinks('https://cdn.discordapp.com/avatars/1/abc.webp?size=128', false).map((link) => link.url),
        [
            'https://cdn.discordapp.com/avatars/1/abc.png?size=4096',
            'https://cdn.discordapp.com/avatars/1/abc.jpg?size=4096',
            'https://cdn.discordapp.com/avatars/1/abc.webp?size=4096',
        ]
    );
    assert.equal(formatLinks('https://cdn.discordapp.com/avatars/1/a_abc.gif', true)[0].label, 'GIF');
    assert.deepEqual(formatLinks('https://cdn.discordapp.com/embed/avatars/3.png', false), [
        { label: 'PNG', url: 'https://cdn.discordapp.com/embed/avatars/3.png' },
    ]);
    assert.equal(
        memberImageUrl(GUILD, '1', 'a_hash', 'banner'),
        `https://cdn.discordapp.com/guilds/${GUILD}/users/1/banners/a_hash.gif?size=4096`
    );
});
