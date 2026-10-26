import './helpers/setupEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, PermissionFlagsBits, PermissionsBitField, UserFlagsBitField, UserFlags } from 'discord.js';
import {
    keyPermissions,
    joinLimited,
    userFields,
    serverFields,
    roleFields,
    channelFields,
} from '../src/features/information/utils/info.js';
import { inviteUrl, BOT_PERMISSIONS } from '../src/shared/utils/invite.js';

const GUILD = '400000000000000001';
/** The fields as { key: value }, skipping the ones left out. */
const asMap = (fields) => Object.fromEntries(fields.filter(Boolean).map(([key, value]) => [key, value]));

test('key permissions: Administrator covers everything, otherwise the notable ones in order', () => {
    const admin = new PermissionsBitField([PermissionFlagsBits.Administrator, PermissionFlagsBits.BanMembers]);
    assert.deepEqual(keyPermissions(admin), ['Administrator']);
    const mod = new PermissionsBitField([
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.ManageGuild,
    ]);
    assert.deepEqual(keyPermissions(mod), ['Manage Server', 'Kick Members']);
    assert.deepEqual(keyPermissions(new PermissionsBitField([PermissionFlagsBits.SendMessages])), []);
});

test('long lists are cut to fit a field', () => {
    const roles = Array.from({ length: 100 }, (_, i) => `<@&${String(i).padStart(18, '0')}>`);
    const text = joinLimited(roles);
    assert.ok(text.length <= 1024);
    assert.match(text, / and \d+ more$/);
    assert.equal(joinLimited(['a', 'b']), 'a, b');
});

function fakeUser(flags = 0) {
    return /** @type {any} */ ({
        id: '300000000000000001',
        bot: false,
        createdAt: new Date('2020-01-01'),
        flags: new UserFlagsBitField(flags),
    });
}

function fakeMember({ owner = false, timedOutUntil = null, permissions = [] } = {}) {
    const roles = new Map([
        [GUILD, { id: GUILD, position: 0, toString: () => '@everyone' }],
        ['r1', { id: 'r1', position: 5, toString: () => '<@&r1>' }],
        ['r2', { id: 'r2', position: 9, toString: () => '<@&r2>' }],
    ]);
    const cache = Object.assign(roles, {
        filter(fn) {
            const kept = [...roles.values()].filter(fn);
            return { sort: (compare) => ({ map: (fn2) => kept.sort(compare).map(fn2) }) };
        },
    });
    return /** @type {any} */ ({
        id: '300000000000000001',
        guild: { id: GUILD, ownerId: owner ? '300000000000000001' : 'someone-else' },
        joinedAt: new Date('2024-05-01'),
        nickname: 'Nick',
        premiumSince: null,
        communicationDisabledUntilTimestamp: timedOutUntil,
        permissions: new PermissionsBitField(permissions),
        roles: { cache, highest: { toString: () => '<@&r2>' } },
    });
}

test('user details: badges, server roles highest first, owner and timeouts', () => {
    const outside = asMap(userFields(fakeUser(UserFlags.ActiveDeveloper | UserFlags.HypeSquadOnlineHouse1), null));
    assert.equal(outside.badges, 'HypeSquad Bravery, Active Developer');
    assert.equal(outside.joined, undefined, 'no server details for someone not in it');

    const member = asMap(userFields(fakeUser(), fakeMember({ timedOutUntil: Date.now() + 60_000 })));
    assert.equal(member.roles, '(2) <@&r2>, <@&r1>');
    assert.equal(member.nickname, 'Nick');
    assert.ok(member.timed_out);
    assert.equal(member.permissions, undefined, 'no notable permissions, no field');

    assert.equal(asMap(userFields(fakeUser(), fakeMember({ owner: true }))).permissions, '👑 Server owner');
    assert.equal(
        asMap(userFields(fakeUser(), fakeMember({ timedOutUntil: Date.now() - 1000 }))).timed_out,
        undefined,
        'an expired timeout is not shown'
    );
});

test('server details count channels by kind', () => {
    const channel = (type) => ({ type });
    const list = [ChannelType.GuildText, ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory].map(
        channel
    );
    const collection = (items) => ({ size: items.length, filter: (fn) => ({ size: items.filter(fn).length }) });
    const guild = /** @type {any} */ ({
        id: GUILD,
        ownerId: '1',
        createdAt: new Date(),
        memberCount: 1234,
        roles: { cache: { size: 6 } },
        emojis: { cache: { size: 3 } },
        stickers: { cache: { size: 1 } },
        channels: { cache: collection(list) },
        premiumTier: 2,
        premiumSubscriptionCount: 9,
        verificationLevel: 1,
        vanityURLCode: null,
        features: ['COMMUNITY', 'SOMETHING_NEW'],
    });
    const fields = asMap(serverFields(guild));
    assert.equal(fields.channels, '💬 2 text\n🔊 1 voice\n📁 1 categories');
    assert.equal(fields.roles_count, '5', '@everyone is not counted');
    assert.equal(fields.features, 'Community', 'unknown features are left out');
    assert.equal(fields.members, '1,234');
    assert.equal(fields.vanity, undefined);
});

test('role details say what manages a role and when members could not be counted', () => {
    const role = /** @type {any} */ ({
        id: '600000000000000001',
        color: 0xb69cff,
        hexColor: '#b69cff',
        position: 3,
        hoist: true,
        mentionable: false,
        createdAt: new Date(),
        tags: { premiumSubscriberRole: true },
        permissions: new PermissionsBitField([PermissionFlagsBits.ManageMessages]),
        guild: { roles: { cache: { size: 11 } } },
    });
    const fields = asMap(roleFields(role, null));
    assert.equal(fields.managed_by, 'Server boosts');
    assert.equal(fields.members, '?');
    assert.equal(fields.position, '3 of 10');
    assert.equal(fields.permissions, 'Manage Messages');
});

test('voice channel details include bitrate and who is connected', () => {
    const channel = /** @type {any} */ ({
        id: '500000000000000001',
        type: ChannelType.GuildVoice,
        parent: { name: 'Voice chats' },
        createdAt: new Date(),
        bitrate: 64000,
        userLimit: 0,
        members: { size: 2 },
        isThread: () => false,
        isVoiceBased: () => true,
    });
    const fields = asMap(channelFields(channel));
    assert.equal(fields.channel_type, 'Voice');
    assert.equal(fields.parent, 'Voice chats');
    assert.equal(fields.bitrate, '64 kbps');
    assert.equal(fields.user_limit, 'None');
    assert.equal(fields.connected, '2');
});

test('the invite link asks for the permissions Ovx uses', () => {
    const url = new URL(inviteUrl('100000000000000000'));
    assert.equal(url.searchParams.get('client_id'), '100000000000000000');
    assert.equal(url.searchParams.get('permissions'), BOT_PERMISSIONS);
    assert.equal(url.searchParams.get('guild_id'), null);
    assert.equal(new URL(inviteUrl('100000000000000000', GUILD)).searchParams.get('disable_guild_select'), 'true');
});
