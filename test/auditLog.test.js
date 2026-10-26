import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    describeLevelChanges,
    describeLoggingChanges,
    describeBotChanges,
    describeAutoRoleChanges,
    describeWelcomeChanges,
    describeTicketChanges,
    describeStreamChanges,
    describeModerationChanges,
} from '../src/dashboard/describeChanges.js';
import { searchPattern, createMongoAuditStore, AUDIT_PAGE_SIZE } from '../src/dashboard/auditStore.js';
import { AuditLog } from '../src/dashboard/models/auditLog.js';

const names = {
    channel: (id) => (id ? ({ c1: '#general', c2: '#level-ups', c3: '#mod-logs' }[id] ?? 'deleted channel') : 'none'),
    role: (id) => ({ r1: '@Regular', r2: '@Legend' })[id] ?? 'deleted role',
};

const levels = {
    enabled: false,
    channelId: null,
    levelUpMessage: null,
    messageCooldown: 60,
    maxLevel: 100,
    removePastRewards: false,
    publicLeaderboard: false,
    rewards: [{ level: 10, roleId: 'r1' }],
    blacklisted: { roleIds: [], channelIds: ['c1'] },
};

test('describes every kind of level setting change', () => {
    const after = {
        ...levels,
        enabled: true,
        channelId: 'c2',
        levelUpMessage: 'GG {user}',
        messageCooldown: 120,
        maxLevel: 50,
        removePastRewards: true,
        publicLeaderboard: true,
        rewards: [{ level: 25, roleId: 'r2' }],
        blacklisted: { roleIds: ['r1'], channelIds: [] },
    };

    assert.deepEqual(describeLevelChanges(levels, after, names), [
        'Levels: off → on',
        'Level-up channel: none → #level-ups',
        'Level-up message changed',
        'Message cooldown: 60s → 120s',
        'Max level: 100 → 50',
        'Remove past rewards: off → on',
        'Public leaderboard: off → on',
        'Added reward: level 25 → @Legend',
        'Removed reward: level 10 → @Regular',
        'Added no-xp role: @Regular',
        'Removed no-xp channel: #general',
    ]);
});

test('no changes means nothing to log', () => {
    assert.deepEqual(describeLevelChanges(levels, structuredClone(levels), names), []);
});

test('changing a reward level counts as removing the old one and adding the new one', () => {
    const after = { ...levels, rewards: [{ level: 15, roleId: 'r1' }] };
    assert.deepEqual(describeLevelChanges(levels, after, names), [
        'Added reward: level 15 → @Regular',
        'Removed reward: level 10 → @Regular',
    ]);
});

test('resetting the level-up message is described as such', () => {
    const before = { ...levels, levelUpMessage: 'Custom' };
    assert.deepEqual(describeLevelChanges(before, levels, names), ['Level-up message reset to the default']);
});

test('describes logging changes per log type and ignored channels', () => {
    const before = {
        types: { message: { enabled: true, channelId: 'c3' }, voice: { enabled: false, channelId: null } },
        ignoredChannels: ['c1'],
    };
    const after = {
        types: { message: { enabled: false, channelId: 'c3' }, voice: { enabled: true, channelId: 'c2' } },
        ignoredChannels: ['c2'],
    };

    assert.deepEqual(describeLoggingChanges(before, after, names), [
        'Message logs: on → off',
        'Voice logs: off → on',
        'Voice logs channel: none → #level-ups',
        'Added ignored channel: #level-ups',
        'Removed ignored channel: #general',
    ]);
});

test('names that no longer exist are shown as deleted', () => {
    const after = { ...levels, blacklisted: { roleIds: ['gone'], channelIds: ['c1'] } };
    assert.deepEqual(describeLevelChanges(levels, after, names), ['Added no-xp role: deleted role']);
});

test('search text is matched literally, case-insensitively', () => {
    const pattern = searchPattern('  Max (level)  ');
    assert.ok(pattern.test('Max (level): 100 → 50'));
    assert.ok(pattern.test('max (LEVEL)'));
    assert.equal(pattern.test('Max level'), false, 'parentheses are literal, not a regex group');

    assert.equal(searchPattern('.*').test('anything'), false, '.* only matches the literal characters');
    assert.ok(searchPattern('.*').test('a .* b'));
});

test('search text is length-limited and empty searches are ignored', () => {
    assert.equal(searchPattern('   '), null);
    assert.equal(searchPattern(undefined), null);
    assert.equal(searchPattern(['array']), null, 'repeated query params arrive as arrays');
    assert.equal(searchPattern('x'.repeat(500)).source.length, 100);
});

// ---------- MongoDB store queries (database call replaced) ----------

function captureFind(docs = []) {
    const calls = [];
    AuditLog.find = (query) => {
        const call = { query };
        calls.push(call);
        const chain = {
            sort: (sort) => ((call.sort = sort), chain),
            limit: (limit) => ((call.limit = limit), chain),
            lean: async () => docs,
        };
        return chain;
    };
    return calls;
}

const doc = (n) => ({
    _id: n.toString(16).padStart(24, '0'),
    createdAt: new Date(),
    userId: '1',
    username: 'dexvo',
    displayName: 'Dexvo',
    avatar: null,
    action: 'Updated level settings',
    changes: [],
});

test('the store lists newest first, one extra to know if there is another page', async () => {
    const calls = captureFind();
    await createMongoAuditStore().list('guild', {});
    assert.deepEqual(calls[0].query, { guildId: 'guild' });
    assert.deepEqual(calls[0].sort, { _id: -1 });
    assert.equal(calls[0].limit, AUDIT_PAGE_SIZE + 1);
});

test('username and action searches combine, each matching their own fields', async () => {
    const calls = captureFind();
    await createMongoAuditStore().list('guild', { username: 'dex', action: 'max' });

    const [userClause, actionClause] = calls[0].query.$and;
    assert.deepEqual(Object.keys(userClause.$or[0]), ['username']);
    assert.deepEqual(Object.keys(userClause.$or[1]), ['displayName']);
    assert.deepEqual(Object.keys(actionClause.$or[0]), ['action']);
    assert.deepEqual(Object.keys(actionClause.$or[1]), ['changes']);
    assert.deepEqual(Object.keys(actionClause.$or[2]), ['source'], 'so "/level" finds slash command changes');
    assert.equal(calls[0].query.guildId, 'guild', 'always limited to the one server');
});

test('only a valid cursor is used, so it cannot inject query operators', async () => {
    const calls = captureFind();
    const store = createMongoAuditStore();
    await store.list('guild', { before: '0123456789abcdef01234567' });
    await store.list('guild', { before: '{"$gt":""}' });

    assert.deepEqual(calls[0].query._id, { $lt: '0123456789abcdef01234567' });
    assert.equal(calls[1].query._id, undefined);
});

test('a next-page cursor is only returned when there are more entries', async () => {
    captureFind(Array.from({ length: AUDIT_PAGE_SIZE + 1 }, (_, i) => doc(1000 - i)));
    const full = await createMongoAuditStore().list('guild', {});
    assert.equal(full.entries.length, AUDIT_PAGE_SIZE);
    assert.equal(full.nextCursor, full.entries.at(-1).id);

    captureFind([doc(5)]);
    const last = await createMongoAuditStore().list('guild', {});
    assert.equal(last.nextCursor, null);
});

test('describes nickname changes, including going back to the default', () => {
    const view = (nickname) => ({ username: 'Ovx', nickname });
    assert.deepEqual(describeBotChanges(view(null), view('Mushy')), ['Nickname: Ovx (default) → Mushy']);
    assert.deepEqual(describeBotChanges(view('Mushy'), view('Shroom')), ['Nickname: Mushy → Shroom']);
    assert.deepEqual(describeBotChanges(view('Mushy'), view(null)), ['Nickname reset: Mushy → Ovx']);
    assert.deepEqual(describeBotChanges(view('Mushy'), view('Mushy')), []);
});

test('describes avatar, banner, About Me and embed colour changes', () => {
    const view = (changes = {}) => ({
        username: 'Ovx',
        nickname: null,
        customAvatar: null,
        banner: null,
        bio: null,
        embedColour: null,
        ...changes,
    });
    assert.deepEqual(
        describeBotChanges(view(), view({ customAvatar: 'a', banner: 'b', bio: 'Hi', embedColour: '#ff00aa' })),
        ['Avatar added', 'Banner added', 'About Me changed', 'Embed colour: default → #ff00aa']
    );
    assert.deepEqual(
        describeBotChanges(view({ customAvatar: 'a', banner: 'b', bio: 'Hi', embedColour: '#ff00aa' }), view()),
        [
            'Avatar removed (back to the default)',
            'Banner removed (back to the default)',
            'About Me removed',
            'Embed colour: #ff00aa → default',
        ]
    );
    assert.deepEqual(describeBotChanges(view({ customAvatar: 'a' }), view({ customAvatar: 'b' })), ['Avatar changed']);
});

test('describes auto role changes', () => {
    const before = { enabled: false, humanRoleIds: ['r1'], botRoleIds: [] };
    const after = { enabled: true, humanRoleIds: ['r2'], botRoleIds: ['r1'] };
    assert.deepEqual(describeAutoRoleChanges(before, after, names), [
        'Auto roles: off → on',
        'Added role for new members: @Legend',
        'Removed role for new members: @Regular',
        'Added role for new bots: @Regular',
    ]);
});

test('describes welcome and goodbye changes', () => {
    const off = { enabled: false, channelId: null, message: null, embed: false, title: null };
    const before = { welcome: off, goodbye: { ...off, message: 'Bye' } };
    const after = {
        welcome: { enabled: true, channelId: 'c1', message: 'Hi', embed: true, title: 'Welcome' },
        goodbye: off,
    };
    assert.deepEqual(describeWelcomeChanges(before, after, names), [
        'Welcome messages: off → on',
        'Welcome channel: none → #general',
        'Welcome message changed',
        'Welcome embed: off → on',
        'Welcome embed title changed',
        'Goodbye message reset to the default',
    ]);
});

test('describes ticket setting changes', () => {
    const base = {
        enabled: false,
        categoryId: null,
        transcriptChannelId: null,
        staffRoleIds: [],
        pingStaff: true,
        maxOpenPerUser: 1,
        ownerCanClose: true,
        dmTranscript: true,
        openMessage: null,
        panel: { title: null, description: null, buttonLabel: null },
    };
    const after = {
        ...base,
        enabled: true,
        categoryId: 'c3',
        transcriptChannelId: 'c1',
        staffRoleIds: ['r1'],
        maxOpenPerUser: 2,
        panel: { ...base.panel, title: 'Help' },
    };
    assert.deepEqual(describeTicketChanges(base, after, names), [
        'Tickets: off → on',
        'Ticket category: none → mod-logs',
        'Transcript channel: none → #general',
        'Open tickets per member: 1 → 2',
        'Panel title changed',
        'Added staff role: @Regular',
    ]);
});

test('describes ticket type changes, matched by ID', () => {
    const base = {
        enabled: true,
        categoryId: null,
        transcriptChannelId: null,
        staffRoleIds: [],
        pingStaff: true,
        maxOpenPerUser: 1,
        ownerCanClose: true,
        dmTranscript: true,
        openMessage: null,
        panel: { title: null, description: null, buttonLabel: null },
    };
    const type = (id, label, extra = {}) => ({ id, label, emoji: null, style: 'primary', ...extra });
    const before = { ...base, ticketTypes: [type('a', 'Support'), type('b', 'Bugs'), type('c', 'Old')] };
    const after = {
        ...base,
        ticketTypes: [type('b', 'Bug Reports'), type('a', 'Support', { emoji: '🎫' }), type('d', 'Unban')],
    };

    assert.deepEqual(describeTicketChanges(before, after, names), [
        'Changed ticket type: Bugs → Bug Reports',
        'Changed ticket type: Support',
        'Added ticket type: Unban',
        'Removed ticket type: Old',
        'Reordered ticket types',
    ]);
});

test('describes stream notification changes', () => {
    const sub = (id, extra = {}) => ({
        id,
        platform: 'twitch',
        account: { displayName: id === 'a' ? 'shroud' : 'pokimane' },
        channelId: 'c1',
        roleId: null,
        liveMessage: null,
        videoMessage: null,
        notifyLive: true,
        notifyVideos: true,
        ...extra,
    });
    assert.deepEqual(
        describeStreamChanges(
            [sub('a')],
            [sub('a', { channelId: 'c2', roleId: 'everyone', liveMessage: 'Hi' }), sub('b')],
            names
        ),
        [
            'Twitch shroud: channel #general → #level-ups',
            'Twitch shroud: ping no ping → @everyone',
            'Twitch shroud: live message changed',
            'Followed Twitch pokimane in #general',
        ]
    );
    assert.deepEqual(describeStreamChanges([sub('a')], [], names), ['Unfollowed Twitch shroud']);
});

test('describes automatic moderation changes', () => {
    const before = {
        warnActions: [
            { warnings: 3, action: 'mute', durationMs: 3_600_000 },
            { warnings: 5, action: 'kick', durationMs: null },
        ],
    };
    const after = {
        warnActions: [
            { warnings: 3, action: 'mute', durationMs: 86_400_000 },
            { warnings: 7, action: 'ban', durationMs: null },
        ],
    };
    assert.deepEqual(describeModerationChanges(before, after), [
        'At 3 warnings: mute for 1 hour → mute for 1 day',
        'At 7 warnings: added ban',
        'At 5 warnings: removed kick',
    ]);
    assert.deepEqual(describeModerationChanges(after, after), []);
});
