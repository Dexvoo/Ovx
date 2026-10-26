import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, Collection, DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import Guild_Level_Cache from '../src/features/levels/cache/guildLevels.cache.js';
import User_Levels_Cache from '../src/features/levels/cache/userLevels.cache.js';
import Logs_Cache from '../src/features/logging/cache/logs.cache.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';
import Auto_Roles_Cache from '../src/features/autoRoles/cache/autoRoles.cache.js';
import Welcome_Cache from '../src/features/welcome/cache/welcome.cache.js';
import Ticket_Config_Cache from '../src/features/tickets/cache/ticketConfig.cache.js';
import Moderation_Config_Cache from '../src/features/moderation/cache/moderationConfig.cache.js';
import { StreamSubscription } from '../src/features/streams/models/streamSubscription.js';
import Invite_Config_Cache from '../src/features/inviteBlocker/cache/inviteConfig.cache.js';
import { withInviteDefaults } from '../src/features/inviteBlocker/models/inviteConfig.js';
import Honeypot_Config_Cache from '../src/features/honeypot/cache/honeypotConfig.cache.js';
import { withHoneypotDefaults } from '../src/features/honeypot/models/honeypotConfig.js';
import Starboard_Config_Cache, { starboardDefaults } from '../src/features/starboard/cache/starboardConfig.cache.js';
import Temp_Voice_Config_Cache, { tempVoiceDefaults } from '../src/features/tempVoice/cache/tempVoiceConfig.cache.js';
import Verification_Config_Cache from '../src/features/verification/cache/verificationConfig.cache.js';
import { verificationDefaults } from '../src/features/verification/models/verification.js';
import Command_Settings_Cache from '../src/features/commandSettings/cache/commandSettings.cache.js';
import { commandSettingsDefaults } from '../src/features/commandSettings/models/commandSettings.js';
import { handle } from '../src/dashboard/shardHandlers.js';
import { ALLOWED_SIZES } from '@discordjs/rest';

const GUILD_ID = '400000000000000001';
const MANAGER = '300000000000000001';
const MEMBER = '300000000000000002';
const STRANGER = '300000000000000003';
const TEXT = '500000000000000001';
const ROLE = '600000000000000001';
const EMOJI = '800000000000000001';

let config;
let saved;
let botSettings;
let autoRoles;
let autoRoleWrites;
let welcome;
let welcomeWrites;
let tickets;
let ticketWrites;
let streams;
let moderation;
let storedSettings;

/** Image links throw on sizes Discord doesn't serve, like discord.js does. */
function checkSize(options) {
    if (options?.size !== undefined && !ALLOWED_SIZES.includes(options.size)) {
        throw new RangeError(`Invalid size provided: ${options.size}`);
    }
}

/**
 * The bot's own member in the fake guild.
 * Also accepts editMe options, where the nickname is called nick.
 * @param {{ nickname?: string | null, nick?: string | null, avatar?: string | null, banner?: string | null,
 *   canChangeNickname?: boolean }} [state]
 */
function fakeMe({ nickname = null, nick, avatar = null, banner = null, canChangeNickname = true } = {}) {
    return {
        nickname: nick !== undefined ? nick : nickname,
        avatar,
        banner,
        roles: { highest: { position: 10 } },
        permissions: { has: () => canChangeNickname },
        permissionsIn: () => ({ has: () => true }),
        avatarURL: (options) => (checkSize(options), avatar ? 'https://cdn.discordapp.com/guilds/avatar.png' : null),
        bannerURL: (options) => (checkSize(options), banner ? 'https://cdn.discordapp.com/guilds/banner.png' : null),
        displayAvatarURL: (options) =>
            (checkSize(options) ?? avatar)
                ? 'https://cdn.discordapp.com/guilds/avatar.png'
                : 'https://cdn.discordapp.com/avatars/1/default.png',
    };
}

/**
 * @param {{ canChangeNickname?: boolean, editMe?: (options: any) => Promise<any>, me?: object }} [options]
 */
function makeClient({ canChangeNickname = true, editMe, me = {} } = {}) {
    const members = {
        [MANAGER]: {
            id: MANAGER,
            user: { username: 'manager' },
            displayName: 'Manager',
            permissions: { has: () => true },
            displayAvatarURL: () => null,
        },
        [MEMBER]: { displayName: 'Member', permissions: { has: () => false }, displayAvatarURL: () => null },
    };
    const channel = {
        id: TEXT,
        name: 'general',
        type: ChannelType.GuildText,
        rawPosition: 0,
        parent: null,
        isThread: () => false,
        isVoiceBased: () => false,
        isTextBased: () => true,
    };
    const guild = {
        id: GUILD_ID,
        name: 'Test',
        memberCount: 3,
        iconURL: () => null,
        channels: { cache: new Collection([[TEXT, channel]]) },
        emojis: {
            cache: new Collection([
                [
                    EMOJI,
                    {
                        id: EMOJI,
                        name: 'mushroom',
                        animated: false,
                        imageURL: () => 'https://cdn.discordapp.com/emojis/1.webp',
                    },
                ],
            ]),
        },
        roles: {
            cache: new Collection([
                [GUILD_ID, { id: GUILD_ID, name: '@everyone', position: 0, managed: false, hexColor: '#000000' }],
                [ROLE, { id: ROLE, name: 'Regular', position: 1, managed: false, hexColor: '#a78bfa' }],
            ]),
        },
        members: {
            cache: new Collection(Object.entries(members)),
            me: fakeMe({ canChangeNickname, ...me }),
            editMe: editMe ?? (async (options) => fakeMe(options)),
            async fetch({ user }) {
                if (Array.isArray(user)) return new Collection();
                if (!members[user]) throw new Error('Unknown Member');
                return members[user];
            },
        },
    };
    guild.client = {
        user: {
            username: 'Ovx',
            displayAvatarURL: (options) => checkSize(options) ?? 'https://cdn.discordapp.com/avatars/1/default.png',
        },
    };
    return { guilds: { cache: new Collection([[GUILD_ID, guild]]) } };
}

beforeEach(() => {
    config = {
        guildId: GUILD_ID,
        _id: 'internal',
        enabled: false,
        channelId: null,
        levelUpMessage: null,
        messageCooldown: 60,
        maxLevel: 100,
        removePastRewards: false,
        publicLeaderboard: false,
        rewards: [],
        blacklisted: { roleIds: [], channelIds: [] },
    };
    saved = [];
    Guild_Level_Cache.get = async () => config;
    Guild_Level_Cache.set = async (guildId, updates) => {
        saved.push({ guildId, updates });
        return { ...config, ...updates };
    };
    Logs_Cache.get = async () => ({ guildId: GUILD_ID });
    botSettings = { guildId: GUILD_ID, bio: null, embedColour: null };
    storedSettings = [];
    Guild_Settings_Cache.get = async () => botSettings;
    autoRoles = { guildId: GUILD_ID, enabled: false, humanRoleIds: [], botRoleIds: [] };
    autoRoleWrites = [];
    Auto_Roles_Cache.get = async () => autoRoles;
    welcome = Welcome_Cache.createDefault(GUILD_ID);
    welcomeWrites = [];
    Welcome_Cache.get = async () => welcome;
    tickets = Ticket_Config_Cache.createDefault(GUILD_ID);
    ticketWrites = [];
    Ticket_Config_Cache.get = async () => tickets;
    moderation = { guildId: GUILD_ID, warnActions: [] };
    Moderation_Config_Cache.get = async () => moderation;
    Moderation_Config_Cache.set = async (guildId, updates) => (moderation = { guildId, ...updates });
    // Settings the overview also shows; without these the tests would wait on a database that isn't there
    Invite_Config_Cache.get = /** @type {any} */ (async (guildId) => withInviteDefaults(guildId));
    Honeypot_Config_Cache.get = /** @type {any} */ (async (guildId) => withHoneypotDefaults(guildId));
    Starboard_Config_Cache.get = /** @type {any} */ (async (guildId) => starboardDefaults(guildId));
    Temp_Voice_Config_Cache.get = /** @type {any} */ (async (guildId) => tempVoiceDefaults(guildId));
    Verification_Config_Cache.get = /** @type {any} */ (async (guildId) => verificationDefaults(guildId));
    Command_Settings_Cache.get = /** @type {any} */ (async (guildId) => commandSettingsDefaults(guildId));
    streams = [];
    StreamSubscription.find = (filter) => ({
        sort: () => ({
            lean: async () =>
                streams.filter(
                    (s) => s.guildId === filter.guildId && (!filter.platform || s.platform === filter.platform)
                ),
        }),
    });
    StreamSubscription.countDocuments = async (filter) => streams.filter((s) => s.guildId === filter.guildId).length;
    Ticket_Config_Cache.set = async (guildId, updates) => {
        ticketWrites.push(updates);
        tickets = { ...tickets, ...updates };
        return tickets;
    };
    Welcome_Cache.set = async (guildId, updates) => {
        welcomeWrites.push(updates);
        welcome = { ...welcome, ...updates };
        return welcome;
    };
    Auto_Roles_Cache.set = async (guildId, updates) => {
        autoRoleWrites.push(updates);
        autoRoles = { ...autoRoles, ...updates };
        return autoRoles;
    };
    Guild_Settings_Cache.set = async (guildId, updates) => {
        storedSettings.push(updates);
        botSettings = { ...botSettings, ...updates };
        return botSettings;
    };
    User_Levels_Cache.getTopUsers = async () => [
        { userId: MEMBER, level: 2, xp: 300, totalMessages: 10, totalVoice: 5, totalCommands: 1 },
    ];
});

test('unknown actions are refused', async () => {
    const result = await handle(makeClient(), 'constructor', {});
    assert.deepEqual(result, { ok: false, status: 400, error: 'Unknown action' });
});

test('only members with Manage Server can open the settings', async () => {
    const client = makeClient();
    assert.equal((await handle(client, 'guildOverview', { guildId: GUILD_ID, userId: MEMBER })).status, 403);
    assert.equal((await handle(client, 'guildOverview', { guildId: GUILD_ID, userId: STRANGER })).status, 403);
    assert.equal((await handle(client, 'guildOverview', { guildId: 'bad', userId: MANAGER })).status, 404);
    assert.equal((await handle(client, 'guildOverview', { guildId: GUILD_ID, userId: undefined })).status, 401);
});

test('the overview has guild data and settings, without internal fields', async () => {
    const result = await handle(makeClient(), 'guildOverview', { guildId: GUILD_ID, userId: MANAGER });

    assert.equal(result.ok, true);
    assert.equal(result.data.guild.name, 'Test');
    assert.deepEqual(
        result.data.channels.map((c) => [c.id, c.type, c.botCanPost]),
        [[TEXT, 'text', true]]
    );
    assert.deepEqual(
        result.data.roles.map((r) => r.id),
        [ROLE],
        'everyone role left out'
    );
    assert.equal('_id' in result.data.levels, false);
    assert.equal('guildId' in result.data.levels, false);
});

test('saving validates, then writes through the guild cache', async () => {
    const result = await handle(makeClient(), 'saveLevelSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        settings: { enabled: true, channelId: TEXT, rewards: [{ level: 5, roleId: ROLE }] },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(saved, [
        {
            guildId: GUILD_ID,
            updates: { enabled: true, channelId: TEXT, rewards: [{ level: 5, roleId: ROLE }] },
        },
    ]);
});

test('invalid settings are rejected with reasons and nothing is saved', async () => {
    const result = await handle(makeClient(), 'saveLevelSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        settings: { maxLevel: 0 },
    });

    assert.equal(result.status, 400);
    assert.equal(result.details.length, 1);
    assert.equal(saved.length, 0);
});

test('members without Manage Server cannot save', async () => {
    const result = await handle(makeClient(), 'saveLevelSettings', {
        guildId: GUILD_ID,
        userId: MEMBER,
        settings: { enabled: false },
    });
    assert.equal(result.status, 403);
    assert.equal(saved.length, 0);
});

test('public leaderboards are hidden unless the server opted in', async () => {
    const client = makeClient();
    const request = { guildId: GUILD_ID, type: 'level', limit: 50 };

    const hidden = await handle(client, 'leaderboard', request);
    assert.deepEqual(hidden, { ok: false, status: 404, error: 'Leaderboard not found' });

    const unknownGuild = await handle(client, 'leaderboard', { ...request, guildId: '400000000000000099' });
    assert.deepEqual(unknownGuild, hidden, 'same response, so server IDs cannot be probed');

    config.publicLeaderboard = true;
    const shown = await handle(client, 'leaderboard', request);
    assert.equal(shown.ok, true);
    assert.equal(shown.data.entries[0].name, 'Member');
    assert.equal(shown.data.entries[0].rank, 1);
});

test('managers can preview a private leaderboard; others cannot', async () => {
    const client = makeClient();
    const preview = await handle(client, 'leaderboard', { guildId: GUILD_ID, type: 'level', viewerId: MANAGER });
    assert.equal(preview.ok, true);

    const denied = await handle(client, 'leaderboard', { guildId: GUILD_ID, type: 'level', viewerId: MEMBER });
    assert.equal(denied.status, 403);
});

test('unknown leaderboard types are rejected', async () => {
    const result = await handle(makeClient(), 'leaderboard', { guildId: GUILD_ID, type: 'xp; drop' });
    assert.equal(result.status, 400);
});

test('botGuilds only reports servers on this shard and rejects bad input', async () => {
    const client = makeClient();
    assert.deepEqual((await handle(client, 'botGuilds', { guildIds: [GUILD_ID, '400000000000000099', 42] })).data, [
        GUILD_ID,
    ]);
    assert.equal((await handle(client, 'botGuilds', { guildIds: 'nope' })).status, 400);
});

// ---------- Logging ----------

test('the overview includes logging settings for every log type', async () => {
    Logs_Cache.get = async () => ({
        guildId: GUILD_ID,
        message: { enabled: true, channelId: TEXT },
        join: { enabled: true, channelId: TEXT },
        member: { enabled: true, channelId: TEXT },
    });
    const result = await handle(makeClient(), 'guildOverview', { guildId: GUILD_ID, userId: MANAGER });

    assert.deepEqual(Object.keys(result.data.logging.types), [
        'message',
        'channel',
        'member',
        'join',
        'leave',
        'voice',
        'role',
        'server',
        'punishment',
    ]);
    assert.deepEqual(result.data.logging.types.message, { enabled: true, channelId: TEXT });
    // Leave logs were never set up, so they show the member log settings they still follow
    assert.deepEqual(result.data.logging.types.leave, { enabled: true, channelId: TEXT });
    assert.deepEqual(result.data.logging.types.voice, { enabled: false, channelId: null });
    assert.deepEqual(result.data.logging.ignoredChannels, []);
});

test('test logs: posted to each switched-on log channel, failures explained, and not spammable', async () => {
    const client = makeClient();
    const sent = [];
    client.guilds.cache.get(GUILD_ID).channels.cache.get(TEXT).send = async (message) => sent.push(message);
    const run = (userId = MANAGER) => handle(client, 'testLogs', { guildId: GUILD_ID, userId });

    assert.equal((await run(MEMBER)).status, 403);
    assert.match((await run()).error, /No log types are switched on/);

    Logs_Cache.get = async () => ({
        guildId: GUILD_ID,
        message: { enabled: true, channelId: TEXT },
        voice: { enabled: true, channelId: '500000000000000099' }, // deleted channel
        role: { enabled: false, channelId: TEXT },
    });
    const result = await run();
    assert.deepEqual(result.data.results, [
        { type: 'message', ok: true, channel: 'general' },
        { type: 'voice', ok: false, error: 'The channel no longer exists' },
    ]);
    assert.equal(sent.length, 1, 'switched-off types get nothing');
    assert.match(sent[0].embeds[0].data.description, /\*\*Messages\*\* logs/);
    assert.deepEqual(sent[0].allowedMentions, { parse: [] });

    const again = await run();
    assert.equal(again.status, 429);
    assert.equal(sent.length, 1);
});

test('saving logging settings validates, then writes through the logs cache', async () => {
    const writes = [];
    Logs_Cache.set = async (guildId, updates) => {
        writes.push({ guildId, updates });
        return { guildId, ...updates };
    };

    const ok = await handle(makeClient(), 'saveLoggingSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        settings: { types: { member: { enabled: true, channelId: TEXT } } },
    });
    assert.equal(ok.ok, true);
    assert.deepEqual(writes, [{ guildId: GUILD_ID, updates: { member: { enabled: true, channelId: TEXT } } }]);
    assert.deepEqual(ok.data.types.member, { enabled: true, channelId: TEXT });

    const denied = await handle(makeClient(), 'saveLoggingSettings', {
        guildId: GUILD_ID,
        userId: MEMBER,
        settings: { types: { member: { enabled: false, channelId: null } } },
    });
    assert.equal(denied.status, 403);
    assert.equal(writes.length, 1, 'nothing saved for non-managers');
});

// ---------- Web Logs ----------

test('saves return descriptions of what changed, using current names', async () => {
    const result = await handle(makeClient(), 'saveLevelSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        settings: { enabled: true, channelId: TEXT },
    });
    assert.deepEqual(result.changes, ['Levels: off → on', 'Level-up channel: none → #general']);
});

test('the access check only passes for members with Manage Server', async () => {
    const client = makeClient();
    assert.deepEqual(await handle(client, 'access', { guildId: GUILD_ID, userId: MANAGER }), { ok: true, data: true });
    assert.equal((await handle(client, 'access', { guildId: GUILD_ID, userId: MEMBER })).status, 403);
});

// ---------- Bot settings ----------

const AVATAR =
    'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]).toString('base64');

test('a bot with a banner can still be shown (image sizes must be ones Discord serves)', async () => {
    const client = makeClient({ me: { avatar: 'hash', banner: 'hash' } });
    const result = await handle(client, 'guildOverview', { guildId: GUILD_ID, userId: MANAGER });
    assert.equal(result.data.bot.banner, 'https://cdn.discordapp.com/guilds/banner.png');
});

test('the overview includes the bot profile in the server', async () => {
    botSettings = { guildId: GUILD_ID, bio: 'Hi!', embedColour: '#ff00aa' };
    const result = await handle(makeClient(), 'guildOverview', { guildId: GUILD_ID, userId: MANAGER });
    assert.deepEqual(result.data.bot, {
        username: 'Ovx',
        nickname: null,
        avatar: 'https://cdn.discordapp.com/avatars/1/default.png',
        customAvatar: null,
        defaultAvatar: 'https://cdn.discordapp.com/avatars/1/default.png',
        banner: null,
        bio: 'Hi!',
        embedColour: '#ff00aa',
        canChangeNickname: true,
    });
    assert.equal(result.data.limits.NICKNAME_MAX, 32);
    assert.equal(result.data.limits.BIO_MAX, 190);
});

test('profile changes go to Discord in one request, with who made them as the audit log reason', async () => {
    const calls = [];
    const client = makeClient({ editMe: async (options) => (calls.push(options), fakeMe(options)) });

    const result = await handle(client, 'saveBotSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        settings: { nickname: '  Mushy  ', avatar: AVATAR, bio: 'Hello' },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(calls, [
        { nick: 'Mushy', avatar: AVATAR, bio: 'Hello', reason: `Changed on the Ovx dashboard by manager (${MANAGER})` },
    ]);
    assert.equal(result.data.nickname, 'Mushy');
    assert.equal(result.data.customAvatar, 'https://cdn.discordapp.com/guilds/avatar.png');
    assert.deepEqual(result.changes, ['Nickname: Ovx (default) → Mushy', 'Avatar added', 'About Me changed']);
    assert.deepEqual(storedSettings, [{ bio: 'Hello' }], 'About Me is stored, since Discord does not return it');
});

test('only what changed is sent to Discord, and colour-only changes never call it', async () => {
    let calls = 0;
    const client = makeClient({ editMe: async (options) => (calls++, fakeMe(options)) });
    const save = (settings) => handle(client, 'saveBotSettings', { guildId: GUILD_ID, userId: MANAGER, settings });

    const same = await save({ nickname: '', avatar: null, banner: null, bio: null });
    assert.deepEqual(same.changes, []);
    assert.equal(calls, 0, 'nothing to remove and the nickname is already the default');

    const colour = await save({ embedColour: '#A78BFA' });
    assert.equal(calls, 0);
    assert.deepEqual(colour.changes, ['Embed colour: default → #a78bfa']);
    assert.deepEqual(storedSettings, [{ embedColour: '#a78bfa' }]);
});

test('bot settings need Manage Server, valid input and the Change Nickname permission for nicknames', async () => {
    const save = (client, userId, settings) =>
        handle(client, 'saveBotSettings', { guildId: GUILD_ID, userId, settings });

    assert.equal((await save(makeClient(), MEMBER, { nickname: 'x' })).status, 403);
    assert.equal((await save(makeClient(), MANAGER, { nickname: 'x'.repeat(33) })).status, 400);
    assert.equal((await save(makeClient(), MANAGER, { avatar: 'https://example.com/a.png' })).status, 400);
    assert.equal((await save(makeClient(), MANAGER, { status: 'x' })).status, 400);

    const noPermission = await save(makeClient({ canChangeNickname: false }), MANAGER, { nickname: 'x' });
    assert.equal(noPermission.status, 400);
    assert.match(noPermission.error, /Change Nickname/);

    // Other profile changes don't need it
    const avatarOnly = await save(makeClient({ canChangeNickname: false }), MANAGER, { avatar: AVATAR });
    assert.equal(avatarOnly.ok, true);
});

test('when Discord refuses a change, its reason is shown with the field it applies to', async () => {
    const rejection = (errors) =>
        new DiscordAPIError(
            { code: RESTJSONErrorCodes.InvalidFormBodyOrContentType, message: 'Invalid Form Body', errors },
            RESTJSONErrorCodes.InvalidFormBodyOrContentType,
            400,
            'PATCH',
            '/guilds/x/members/@me',
            { body: {} }
        );
    const save = (error, settings) =>
        handle(makeClient({ editMe: async () => Promise.reject(error) }), 'saveBotSettings', {
            guildId: GUILD_ID,
            userId: MANAGER,
            settings,
        });

    const tooFast = await save(
        rejection({
            avatar: { _errors: [{ code: 'AVATAR_RATE_LIMIT', message: 'You are changing your avatar too fast.' }] },
        }),
        { avatar: AVATAR }
    );
    assert.equal(tooFast.status, 400);
    assert.equal(tooFast.error, 'Avatar: You are changing your avatar too fast.');

    const unknown = await save(rejection({}), { nickname: 'clyde' });
    assert.match(unknown.error, /did not accept/);
});

// ---------- Reset ----------

test('resetting levels puts every level setting back to its default', async () => {
    config = { ...config, enabled: true, maxLevel: 50, rewards: [{ level: 5, roleId: ROLE }] };
    const result = await handle(makeClient(), 'resetSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        section: 'levels',
    });

    assert.equal(result.ok, true);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].updates.enabled, false);
    assert.equal(saved[0].updates.maxLevel, 100);
    assert.deepEqual(saved[0].updates.rewards, []);
    assert.equal('guildId' in saved[0].updates, false);
    assert.ok(result.changes.includes('Levels: on → off'));
    assert.ok(result.changes.includes('Max level: 50 → 100'));
});

test('resetting logging turns every log type off and clears the ignored channels', async () => {
    const writes = [];
    Logs_Cache.get = async () => ({
        guildId: GUILD_ID,
        message: { enabled: true, channelId: TEXT },
        ignoredChannels: [TEXT],
    });
    Logs_Cache.set = async (guildId, updates) => (writes.push(updates), { guildId, ...updates });

    const result = await handle(makeClient(), 'resetSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        section: 'logging',
    });

    assert.equal(result.ok, true);
    assert.deepEqual(writes[0].message, { enabled: false, channelId: null });
    assert.deepEqual(writes[0].join, { enabled: false, channelId: null }, 'join/leave stop following member logs too');
    assert.deepEqual(writes[0].ignoredChannels, []);
    assert.ok(result.changes.includes('Message logs: on → off'));
});

test('resetting the bot removes its profile changes and colour', async () => {
    botSettings = { guildId: GUILD_ID, bio: 'Hi!', embedColour: '#ff00aa' };
    const calls = [];
    const client = makeClient({
        me: { nickname: 'Mushy', avatar: 'hash' },
        editMe: async (options) => (calls.push(options), fakeMe(options)),
    });

    const result = await handle(client, 'resetSettings', { guildId: GUILD_ID, userId: MANAGER, section: 'bot' });

    assert.equal(result.ok, true);
    assert.deepEqual(calls[0], {
        nick: null,
        avatar: null,
        bio: null,
        reason: `Changed on the Ovx dashboard by manager (${MANAGER})`,
    });
    assert.deepEqual(storedSettings, [{ embedColour: null, bio: null }]);
});

test('reset needs Manage Server and a known section', async () => {
    const reset = (userId, section) => handle(makeClient(), 'resetSettings', { guildId: GUILD_ID, userId, section });
    assert.equal((await reset(MEMBER, 'levels')).status, 403);
    assert.equal((await reset(MANAGER, 'everything')).status, 400);
    assert.equal((await reset(MANAGER, '__proto__')).status, 400);
    assert.equal(saved.length, 0);
});

test('a bug in an action comes back as an error result instead of looking like the shard is down', async () => {
    Guild_Level_Cache.get = async () => {
        throw new RangeError('Invalid size provided: 600');
    };
    const result = await handle(makeClient(), 'guildOverview', { guildId: GUILD_ID, userId: MANAGER });

    assert.equal(result.ok, false);
    assert.equal(result.status, 500);
    assert.match(result.error, /Something went wrong/);
    assert.doesNotMatch(result.error, /Invalid size/, 'internal details stay in the console');
});

// ---------- Auto roles ----------

test('the overview has the auto roles, without roles that were deleted', async () => {
    autoRoles = { guildId: GUILD_ID, enabled: true, humanRoleIds: [ROLE, '600000000000000099'], botRoleIds: [] };
    const result = await handle(makeClient(), 'guildOverview', { guildId: GUILD_ID, userId: MANAGER });
    assert.deepEqual(result.data.autoRoles, { enabled: true, humanRoleIds: [ROLE], botRoleIds: [] });
    assert.equal(result.data.botPermissions.manageRoles, true);
});

test('saving auto roles validates, writes through the cache and describes the change', async () => {
    const save = (userId, settings) =>
        handle(makeClient(), 'saveAutoRoleSettings', { guildId: GUILD_ID, userId, settings });

    assert.equal((await save(MEMBER, { enabled: true })).status, 403);
    assert.equal((await save(MANAGER, { humanRoleIds: [GUILD_ID] })).status, 400, 'not the everyone role');
    assert.equal(autoRoleWrites.length, 0);

    const result = await save(MANAGER, { enabled: true, humanRoleIds: [ROLE] });
    assert.equal(result.ok, true);
    assert.deepEqual(autoRoleWrites, [{ enabled: true, humanRoleIds: [ROLE] }]);
    assert.deepEqual(result.changes, ['Auto roles: off → on', 'Added role for new members: @Regular']);
});

test('resetting auto roles switches them off and clears both lists', async () => {
    autoRoles = { guildId: GUILD_ID, enabled: true, humanRoleIds: [ROLE], botRoleIds: [ROLE] };
    const result = await handle(makeClient(), 'resetSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        section: 'auto-roles',
    });
    assert.deepEqual(autoRoleWrites, [{ enabled: false, humanRoleIds: [], botRoleIds: [] }]);
    assert.deepEqual(result.data, { enabled: false, humanRoleIds: [], botRoleIds: [] });
});

// ---------- Welcome and goodbye ----------

test('the overview has the welcome settings and the default texts', async () => {
    const result = await handle(makeClient(), 'guildOverview', { guildId: GUILD_ID, userId: MANAGER });
    assert.equal(result.data.welcome.welcome.enabled, false);
    assert.match(result.data.welcomeDefaults.welcome, /\{user\}/);
    assert.equal(result.data.limits.WELCOME.MESSAGE_MAX, 1500);
});

test('saving welcome settings validates, writes through the cache and describes the change', async () => {
    const save = (userId, settings) =>
        handle(makeClient(), 'saveWelcomeSettings', { guildId: GUILD_ID, userId, settings });
    const message = { enabled: true, channelId: TEXT, message: 'Hi {user}', embed: false, title: null };

    assert.equal((await save(MEMBER, { welcome: message })).status, 403);
    assert.equal((await save(MANAGER, { welcome: { ...message, channelId: '500000000000000099' } })).status, 400);
    assert.equal(welcomeWrites.length, 0);

    const result = await save(MANAGER, { welcome: message });
    assert.equal(result.ok, true);
    assert.deepEqual(welcomeWrites, [{ welcome: message }]);
    assert.deepEqual(result.changes, [
        'Welcome messages: off → on',
        'Welcome channel: none → #general',
        'Welcome message changed',
    ]);
});

test('resetting welcome messages switches both off and clears them', async () => {
    welcome = { ...welcome, goodbye: { enabled: true, channelId: TEXT, message: 'Bye', embed: true, title: 'x' } };
    const result = await handle(makeClient(), 'resetSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        section: 'welcome',
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.data.goodbye, {
        enabled: false,
        channelId: null,
        message: null,
        embed: false,
        title: null,
    });
    assert.ok(result.changes.includes('Goodbye messages: on → off'));
});

// ---------- Tickets ----------

test('the overview has the ticket settings, the default texts and where the panel is', async () => {
    tickets = {
        ...tickets,
        staffRoleIds: [ROLE, '600000000000000099'],
        panel: { ...tickets.panel, channelId: TEXT, messageId: 'm' },
    };
    const result = await handle(makeClient(), 'guildOverview', { guildId: GUILD_ID, userId: MANAGER });
    assert.deepEqual(result.data.tickets.staffRoleIds, [ROLE], 'deleted roles are dropped');
    assert.deepEqual(result.data.ticketPanel, { channelId: TEXT, posted: true });
    assert.match(result.data.ticketDefaults.buttonLabel, /Ticket/);
    assert.deepEqual(result.data.categories, []);
});

test('saving ticket settings validates, writes through the cache and describes the change', async () => {
    const save = (userId, settings) =>
        handle(makeClient(), 'saveTicketSettings', { guildId: GUILD_ID, userId, settings });

    assert.equal((await save(MEMBER, { pingStaff: false })).status, 403);
    assert.equal((await save(MANAGER, { enabled: true })).status, 400, 'needs a category first');
    assert.equal(ticketWrites.length, 0);

    const result = await save(MANAGER, { pingStaff: false, staffRoleIds: [ROLE] });
    assert.equal(result.ok, true);
    assert.deepEqual(ticketWrites, [{ pingStaff: false, staffRoleIds: [ROLE] }]);
    assert.deepEqual(result.changes, ['Ping staff on new tickets: on → off', 'Added staff role: @Regular']);
});

test('posting the ticket panel needs Manage Server and a channel the bot can post in', async () => {
    const post = (userId, channelId) =>
        handle(makeClient(), 'postTicketPanel', { guildId: GUILD_ID, userId, channelId });
    assert.equal((await post(MEMBER, TEXT)).status, 403);
    assert.equal((await post(MANAGER, '500000000000000099')).status, 400);
    assert.equal((await post(MANAGER, { $ne: null })).status, 400);
});

test('resetting tickets keeps the ticket counter and where the panel is', async () => {
    tickets = {
        ...tickets,
        enabled: true,
        categoryId: 'c',
        lastTicketNumber: 42,
        panel: { ...tickets.panel, channelId: TEXT, messageId: 'm', title: 'Help' },
    };
    const result = await handle(makeClient(), 'resetSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        section: 'tickets',
    });

    assert.equal(result.ok, true);
    const [written] = ticketWrites;
    assert.equal(written.enabled, false);
    assert.equal('lastTicketNumber' in written, false);
    assert.equal('panel' in written, false, 'the panel message is kept');
    assert.equal(written['panel.title'], null);
    assert.ok(result.changes.includes('Tickets: on → off'));
});

// ---------- Stream notifications ----------

const SUB_ID = 'a'.repeat(24);
const streamDoc = (extra = {}) => ({
    _id: SUB_ID,
    guildId: GUILD_ID,
    platform: 'youtube',
    accountId: 'UC' + 'a'.repeat(22),
    accountName: 'UC' + 'a'.repeat(22),
    displayName: 'Mushroom TV',
    url: 'https://www.youtube.com/channel/x',
    channelId: TEXT,
    roleId: null,
    notifyLive: true,
    notifyVideos: true,
    ...extra,
});

test('the overview has the followed streamers, which platforms work, and the limit', async () => {
    streams = [streamDoc()];
    const result = await handle(makeClient(), 'guildOverview', { guildId: GUILD_ID, userId: MANAGER });
    assert.equal(result.data.streams[0].account.displayName, 'Mushroom TV');
    assert.deepEqual(result.data.streamLimit, { used: 1, max: 5, premium: false });
    assert.equal(result.data.streamStatus.youtube, true);
    assert.equal(result.data.limits.STREAMS.PREMIUM, 50);
});

test('following a streamer checks the input first, and explains platform problems', async () => {
    const add = (settings) => handle(makeClient(), 'addStream', { guildId: GUILD_ID, userId: MANAGER, settings });
    assert.equal((await add({ platform: 'twitch', query: '', channelId: TEXT })).status, 400);
    assert.equal(
        (await handle(makeClient(), 'addStream', { guildId: GUILD_ID, userId: MEMBER, settings: {} })).status,
        403
    );

    // Twitch has no keys in the tests, so it's switched off
    const off = await add({ platform: 'twitch', query: 'shroud', channelId: TEXT });
    assert.match(off.error, /aren't set up/);

    streams = Array.from({ length: 5 }, (_, i) => streamDoc({ _id: String(i).repeat(24) }));
    const full = await add({ platform: 'youtube', query: 'UC' + 'b'.repeat(22), channelId: TEXT });
    assert.match(full.error, /up to 5 streamers \(50 with premium\)/);
});

test('saving stream settings only touches this server and platform', async () => {
    streams = [streamDoc()];
    const writes = [];
    StreamSubscription.bulkWrite = async (ops) => {
        writes.push(...ops);
        Object.assign(streams[0], ops[0].updateOne.update.$set);
    };
    const settings = [
        {
            id: SUB_ID,
            channelId: TEXT,
            roleId: ROLE,
            liveMessage: null,
            videoMessage: 'New!',
            notifyLive: false,
            notifyVideos: true,
        },
    ];
    const result = await handle(makeClient(), 'saveStreams', {
        guildId: GUILD_ID,
        userId: MANAGER,
        platform: 'youtube',
        settings,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(writes[0].updateOne.filter, { _id: SUB_ID, guildId: GUILD_ID, platform: 'youtube' });
    assert.ok(result.changes.includes('YouTube Mushroom TV: ping no ping → @Regular'));

    const otherPlatform = await handle(makeClient(), 'saveStreams', {
        guildId: GUILD_ID,
        userId: MANAGER,
        platform: 'twitch',
        settings,
    });
    assert.equal(otherPlatform.status, 400, 'a YouTube subscription cannot be saved through the Twitch page');
});

test('unfollowing and resetting a platform', async () => {
    StreamSubscription.findOneAndDelete = (filter) => ({
        lean: async () => (filter._id === SUB_ID && filter.guildId === GUILD_ID ? streamDoc() : null),
    });
    const removed = await handle(makeClient(), 'removeStream', {
        guildId: GUILD_ID,
        userId: MANAGER,
        subscriptionId: SUB_ID,
    });
    assert.deepEqual(removed.changes, ['Unfollowed YouTube Mushroom TV']);
    assert.equal(
        (await handle(makeClient(), 'removeStream', { guildId: GUILD_ID, userId: MANAGER, subscriptionId: { $ne: 1 } }))
            .status,
        404
    );

    streams = [streamDoc()];
    let deleted;
    StreamSubscription.deleteMany = async (filter) => void (deleted = filter);
    const reset = await handle(makeClient(), 'resetSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        section: 'youtube',
    });
    assert.deepEqual(deleted, { guildId: GUILD_ID, platform: 'youtube' });
    assert.deepEqual(reset.changes, ['Unfollowed YouTube Mushroom TV']);
});

// ---------- Automatic moderation ----------

test('automatic actions: shown in the overview, saved after validation, and reset without touching cases', async () => {
    const overview = await handle(makeClient(), 'guildOverview', { guildId: GUILD_ID, userId: MANAGER });
    assert.deepEqual(overview.data.moderation, { warnActions: [] });
    assert.equal(overview.data.limits.WARN_ACTIONS.RULES, 10);

    const save = (settings, userId = MANAGER) =>
        handle(makeClient(), 'saveModerationSettings', { guildId: GUILD_ID, userId, settings });
    assert.equal((await save({ warnActions: [] }, MEMBER)).status, 403);
    assert.equal((await save({ warnActions: [{ warnings: 3, action: 'mute' }] })).status, 400);

    const saved = await save({ warnActions: [{ warnings: 3, action: 'kick' }] });
    assert.deepEqual(saved.data.warnActions, [{ warnings: 3, action: 'kick', durationMs: null }]);
    assert.deepEqual(saved.changes, ['At 3 warnings: added kick']);

    const reset = await handle(makeClient(), 'resetSettings', {
        guildId: GUILD_ID,
        userId: MANAGER,
        section: 'moderation',
    });
    assert.deepEqual(reset.data, { warnActions: [] });
    assert.deepEqual(reset.changes, ['At 3 warnings: removed kick']);
});
