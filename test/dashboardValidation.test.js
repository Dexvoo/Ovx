import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    validateLevelSettings,
    validateLoggingSettings,
    validateBotSettings,
    validateAutoRoleSettings,
    validateWelcomeSettings,
    validateTicketSettings,
    parseButtonEmoji,
    validateStreamAdd,
    validateModerationSettings,
    validateStreamUpdates,
    IMAGE_MAX_BYTES,
} from '../src/dashboard/validation.js';

const TEXT = '100000000000000001';
const VOICE = '100000000000000002';
const ROLE_LOW = '200000000000000001';
const ROLE_HIGH = '200000000000000002';
const ROLE_BOT = '200000000000000003';
const OTHER_SERVER_ID = '900000000000000000';

/** @type {import('../src/dashboard/validation.js').GuildContext} */
const guild = {
    textChannelIds: new Set([TEXT]),
    channelIds: new Set([TEXT, VOICE]),
    roles: new Map([
        [ROLE_LOW, { position: 1, managed: false }],
        [ROLE_HIGH, { position: 10, managed: false }],
        [ROLE_BOT, { position: 2, managed: true }],
    ]),
    botHighestRolePosition: 5,
};
const current = { maxLevel: 100, enabled: false, channelId: null };

const validate = (input, overrides = {}) => validateLevelSettings(input, guild, { ...current, ...overrides });

test('accepts a full valid settings object and returns only known fields', () => {
    const { settings, errors } = validate({
        enabled: true,
        channelId: TEXT,
        levelUpMessage: '  {user} reached {level}!  ',
        messageCooldown: 60,
        maxLevel: 50,
        removePastRewards: true,
        publicLeaderboard: false,
        rewards: [{ level: 10, roleId: ROLE_LOW }],
        blacklisted: { roleIds: [ROLE_LOW], channelIds: [VOICE] },
    });

    assert.deepEqual(errors, []);
    assert.deepEqual(settings, {
        enabled: true,
        channelId: TEXT,
        levelUpMessage: '{user} reached {level}!',
        messageCooldown: 60,
        maxLevel: 50,
        removePastRewards: true,
        publicLeaderboard: false,
        rewards: [{ level: 10, roleId: ROLE_LOW }],
        blacklisted: { roleIds: [ROLE_LOW], channelIds: [VOICE] },
    });
});

test('partial updates only return the fields sent', () => {
    const { settings, errors } = validate({ messageCooldown: 120 });
    assert.deepEqual(errors, []);
    assert.deepEqual(settings, { messageCooldown: 120 });
});

test('rejects unknown keys, including prototype pollution attempts', () => {
    const malicious = JSON.parse('{"__proto__": {"isAdmin": true}, "constructor": {}, "guildId": "x", "maxLevel": 10}');
    const { settings, errors } = validate(malicious);

    assert.deepEqual(settings, {});
    assert.ok(errors.includes('Unknown setting "__proto__"'));
    assert.ok(errors.includes('Unknown setting "guildId"'), 'cannot overwrite which guild a config belongs to');
    assert.equal({}.isAdmin, undefined, 'Object.prototype untouched');
});

test('rejects non-object bodies and empty saves', () => {
    for (const input of [null, [], 'text', 42]) {
        assert.deepEqual(validate(input).errors, ['Settings must be an object']);
    }
    assert.deepEqual(validate({}).errors, ['No settings to save']);
});

test('enforces the same limits as the slash commands', () => {
    assert.equal(validate({ messageCooldown: 19 }).errors.length, 1);
    assert.equal(validate({ messageCooldown: 3601 }).errors.length, 1);
    assert.equal(validate({ messageCooldown: 30.5 }).errors.length, 1, 'whole numbers only');
    assert.equal(validate({ messageCooldown: '60' }).errors.length, 1, 'no strings');
    assert.equal(validate({ maxLevel: 0 }).errors.length, 1);
    assert.equal(validate({ maxLevel: 10001 }).errors.length, 1);
    assert.equal(validate({ levelUpMessage: 'x'.repeat(501) }).errors.length, 1);
    assert.equal(validate({ enabled: 'true' }).errors.length, 1, 'booleans must be real booleans');
});

test('an empty level-up message means "use the default"', () => {
    assert.deepEqual(validate({ levelUpMessage: '   ' }).settings, { levelUpMessage: null });
});

test('the level-up channel must be a text channel in this server', () => {
    assert.equal(validate({ channelId: VOICE }).errors.length, 1, 'voice channel');
    assert.equal(validate({ channelId: OTHER_SERVER_ID }).errors.length, 1, 'another server');
    assert.deepEqual(validate({ channelId: null }).settings, { channelId: null });
});

test('levels cannot be enabled without a level-up channel', () => {
    assert.deepEqual(validate({ enabled: true }).errors, ['Choose a level-up channel before enabling levels']);
    assert.deepEqual(validate({ enabled: true }, { channelId: TEXT }).errors, [], 'uses the saved channel');
    assert.equal(validate({ channelId: null }, { enabled: true, channelId: TEXT }).errors.length, 1);
});

test('rewards must use assignable roles from this server, within the max level', () => {
    const check = (rewards, overrides) => validate({ rewards }, overrides).errors;

    assert.equal(check([{ level: 5, roleId: OTHER_SERVER_ID }]).length, 1, 'role from another server');
    assert.equal(check([{ level: 5, roleId: ROLE_HIGH }]).length, 1, 'role above the bot');
    assert.equal(check([{ level: 5, roleId: ROLE_BOT }]).length, 1, 'managed role');
    assert.equal(check([{ level: 101, roleId: ROLE_LOW }]).length, 1, 'above the saved max level');
    assert.equal(
        validate({ maxLevel: 200, rewards: [{ level: 150, roleId: ROLE_LOW }] }).errors.length,
        0,
        'uses new max'
    );
    assert.equal(
        check([
            { level: 5, roleId: ROLE_LOW },
            { level: 6, roleId: ROLE_LOW },
        ]).length,
        1,
        'same role twice'
    );
    assert.equal(check('not a list').length, 1);
    assert.equal(check(Array.from({ length: 51 }, () => ({ level: 1, roleId: ROLE_LOW }))).length, 1, 'too many');
});

test('rewards come back sorted by level with only level and roleId', () => {
    const { settings } = validate({
        maxLevel: 100,
        rewards: [{ level: 20, roleId: ROLE_LOW, extra: 'ignored' }],
    });
    assert.deepEqual(settings.rewards, [{ level: 20, roleId: ROLE_LOW }]);
});

test('the blacklist only accepts this server’s roles and channels, deduplicated', () => {
    assert.deepEqual(validate({ blacklisted: { roleIds: [ROLE_LOW, ROLE_LOW], channelIds: [] } }).settings, {
        blacklisted: { roleIds: [ROLE_LOW], channelIds: [] },
    });
    assert.equal(validate({ blacklisted: { roleIds: [OTHER_SERVER_ID], channelIds: [] } }).errors.length, 1);
    assert.equal(validate({ blacklisted: { roleIds: [], channelIds: [OTHER_SERVER_ID] } }).errors.length, 1);
    assert.equal(
        validate({ blacklisted: { roleIds: [{ $ne: null }], channelIds: [] } }).errors.length,
        1,
        'no query objects'
    );
    assert.equal(validate({ blacklisted: [] }).errors.length, 1);
});

// ---------- Logging ----------

const validateLogging = (input) => validateLoggingSettings(input, guild);

test('logging: accepts log types and ignored channels', () => {
    const { settings, errors } = validateLogging({
        types: { message: { enabled: true, channelId: TEXT }, voice: { enabled: false, channelId: null } },
        ignoredChannels: [VOICE, VOICE],
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(settings, {
        message: { enabled: true, channelId: TEXT },
        voice: { enabled: false, channelId: null },
        ignoredChannels: [VOICE],
    });
});

test('logging: accepts every log type, including join, leave and server', () => {
    for (const type of ['join', 'leave', 'server']) {
        assert.deepEqual(validateLogging({ types: { [type]: { enabled: true, channelId: TEXT } } }).errors, [], type);
    }
});

test('logging: rejects unknown keys and log types', () => {
    assert.ok(validateLogging({ guildId: 'x' }).errors.includes('Unknown setting "guildId"'));
    for (const type of ['everything', 'Message', '__proto__']) {
        assert.equal(
            validateLogging({ types: { [type]: { enabled: false, channelId: null } } }).errors.length,
            1,
            type
        );
    }
});

test('logging: a log type needs a text channel the bot can post in, and a channel to be on', () => {
    assert.equal(validateLogging({ types: { role: { enabled: true, channelId: VOICE } } }).errors.length, 1);
    assert.equal(validateLogging({ types: { role: { enabled: true, channelId: OTHER_SERVER_ID } } }).errors.length, 1);
    assert.equal(validateLogging({ types: { role: { enabled: true, channelId: null } } }).errors.length, 1);
    assert.equal(validateLogging({ types: { role: { enabled: 'yes', channelId: TEXT } } }).errors.length, 1);
    assert.equal(
        validateLogging({ types: { role: { enabled: false, channelId: TEXT } } }).errors.length,
        0,
        'off but remembered'
    );
});

test('logging: ignored channels must be in this server', () => {
    assert.equal(validateLogging({ ignoredChannels: [OTHER_SERVER_ID] }).errors.length, 1);
    assert.equal(validateLogging({ ignoredChannels: 'nope' }).errors.length, 1);
});

// ---------- Bot settings ----------

test('bot nickname: trimmed, empty resets it, and limited to 32 characters', () => {
    assert.deepEqual(validateBotSettings({ nickname: '  Mushy ' }), { settings: { nickname: 'Mushy' }, errors: [] });
    assert.deepEqual(validateBotSettings({ nickname: '   ' }).settings, { nickname: null });
    assert.deepEqual(validateBotSettings({ nickname: null }).settings, { nickname: null });
    assert.equal(validateBotSettings({ nickname: 'x'.repeat(32) }).errors.length, 0);
    assert.equal(validateBotSettings({ nickname: 'x'.repeat(33) }).errors.length, 1);
    assert.equal(validateBotSettings({ nickname: '🍄'.repeat(32) }).errors.length, 0, 'emojis count as one character');
    assert.equal(validateBotSettings({ nickname: '👨‍👩‍👧 family' }).errors.length, 0, 'joined emojis are allowed');
});

test('bot nickname: rejects wrong types, hidden characters and unknown settings', () => {
    assert.equal(validateBotSettings({ nickname: 5 }).errors.length, 1);
    assert.equal(validateBotSettings({ nickname: 'Ovx\u202e' }).errors.length, 1, 'text direction overrides');
    assert.equal(validateBotSettings({ nickname: 'a\nb' }).errors.length, 1);
    assert.equal(validateBotSettings({ nick: 'x' }).errors.length, 1);
    assert.equal(validateBotSettings({}).errors.length, 1);
    assert.equal(validateBotSettings('Ovx').errors.length, 1);
    assert.equal(validateBotSettings(JSON.parse('{"__proto__":{"nickname":"x"}}')).errors.length, 1);
});

const png = (extra = 1) => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, extra]);
const dataUrl = (type, bytes) => `data:image/${type};base64,${bytes.toString('base64')}`;

test('bot images: real images are accepted, and their own bytes decide the type', () => {
    assert.deepEqual(validateBotSettings({ avatar: dataUrl('png', png()) }).errors, []);
    // Labelled JPEG but really a PNG: saved with the real type
    assert.equal(validateBotSettings({ banner: dataUrl('jpeg', png()) }).settings.banner, dataUrl('png', png()));
    const gif = Buffer.from('GIF89a', 'latin1');
    assert.equal(validateBotSettings({ avatar: dataUrl('gif', gif) }).errors.length, 0);
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
    assert.equal(validateBotSettings({ avatar: dataUrl('webp', webp) }).errors.length, 0);
    assert.deepEqual(validateBotSettings({ avatar: null, banner: null }).settings, { avatar: null, banner: null });
});

test('bot images: anything that is not a small PNG, JPEG, GIF or WebP is refused', () => {
    const refused = (value) => validateBotSettings({ avatar: value }).errors.length === 1;
    assert.ok(refused(dataUrl('png', Buffer.from('<svg onload=alert(1)>'))), 'not really an image');
    assert.ok(refused(`data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`));
    assert.ok(refused('https://example.com/avatar.png'), 'links are not fetched');
    assert.ok(refused(dataUrl('png', png()) + '!'), 'not valid base64');
    assert.ok(refused(42));
    const huge = Buffer.concat([png(), Buffer.alloc(IMAGE_MAX_BYTES)]);
    assert.match(validateBotSettings({ avatar: dataUrl('png', huge) }).errors[0], /2 MB or smaller/);
});

test('bot About Me: up to 190 characters, can have line breaks, no hidden characters', () => {
    assert.deepEqual(validateBotSettings({ bio: ' Line one\nLine two ' }).settings, { bio: 'Line one\nLine two' });
    assert.deepEqual(validateBotSettings({ bio: '' }).settings, { bio: null });
    assert.equal(validateBotSettings({ bio: 'x'.repeat(190) }).errors.length, 0);
    assert.equal(validateBotSettings({ bio: 'x'.repeat(191) }).errors.length, 1);
    assert.equal(validateBotSettings({ bio: 'a\tb' }).errors.length, 1);
    assert.equal(validateBotSettings({ nickname: 'a\nb' }).errors.length, 1, 'nicknames stay on one line');
});

test('embed colour: a hex colour (saved in lowercase) or null for the default', () => {
    assert.deepEqual(validateBotSettings({ embedColour: '#A78BFA' }).settings, { embedColour: '#a78bfa' });
    assert.deepEqual(validateBotSettings({ embedColour: null }).settings, { embedColour: null });
    for (const value of ['a78bfa', '#fff', 'red', '#a78bfa; background:url(x)', 123]) {
        assert.equal(validateBotSettings({ embedColour: value }).errors.length, 1, String(value));
    }
});

// ---------- Auto roles ----------

test('auto roles: valid roles are kept once each, in order', () => {
    assert.deepEqual(
        validateAutoRoleSettings({ enabled: true, humanRoleIds: [ROLE_LOW, ROLE_LOW], botRoleIds: [] }, guild),
        {
            settings: { enabled: true, humanRoleIds: [ROLE_LOW], botRoleIds: [] },
            errors: [],
        }
    );
});

test('auto roles: only roles the bot can give, at most 10, from this server', () => {
    const errorsFor = (roleIds) => validateAutoRoleSettings({ humanRoleIds: roleIds }, guild).errors;
    assert.match(errorsFor([ROLE_HIGH])[0], /above the bot's highest role/);
    assert.match(errorsFor([ROLE_BOT])[0], /managed by an integration/);
    assert.match(errorsFor([OTHER_SERVER_ID])[0], /not in this server/);
    assert.match(errorsFor(Array(11).fill(ROLE_LOW))[0], /at most 10/);
    assert.equal(errorsFor('nope').length, 1);
    assert.equal(errorsFor([{ $gt: '' }]).length, 1);
});

test('auto roles: rejects unknown keys and wrong types', () => {
    assert.equal(validateAutoRoleSettings({ roles: [] }, guild).errors.length, 1);
    assert.equal(validateAutoRoleSettings({ enabled: 'yes' }, guild).errors.length, 1);
    assert.equal(validateAutoRoleSettings({}, guild).errors.length, 1);
    assert.equal(validateAutoRoleSettings(null, guild).errors.length, 1);
});

// ---------- Welcome and goodbye ----------

const welcomeMessage = (overrides = {}) => ({
    enabled: true,
    channelId: TEXT,
    message: '  Hi {user}  ',
    embed: false,
    title: '',
    ...overrides,
});

test('welcome: a valid message is trimmed, and empty text becomes the default (null)', () => {
    assert.deepEqual(validateWelcomeSettings({ welcome: welcomeMessage() }, guild), {
        settings: { welcome: { enabled: true, channelId: TEXT, message: 'Hi {user}', embed: false, title: null } },
        errors: [],
    });
    assert.equal(
        validateWelcomeSettings({ goodbye: welcomeMessage({ message: '' }) }, guild).settings.goodbye.message,
        null
    );
});

test('welcome: needs a channel the bot can post in before it can be on', () => {
    const errorsFor = (overrides) => validateWelcomeSettings({ welcome: welcomeMessage(overrides) }, guild).errors;
    assert.match(errorsFor({ channelId: null })[0], /choose a channel/);
    assert.equal(errorsFor({ channelId: null, enabled: false }).length, 0);
    assert.match(errorsFor({ channelId: VOICE })[0], /text channel/);
    assert.match(errorsFor({ channelId: OTHER_SERVER_ID })[0], /text channel/);
});

test('welcome: text limits, types and unknown keys', () => {
    const errorsFor = (overrides) => validateWelcomeSettings({ welcome: welcomeMessage(overrides) }, guild).errors;
    assert.equal(errorsFor({ message: 'x'.repeat(1500) }).length, 0);
    assert.match(errorsFor({ message: 'x'.repeat(1501) })[0], /at most 1500/);
    assert.match(errorsFor({ title: 'x'.repeat(201) })[0], /at most 200/);
    assert.equal(errorsFor({ embed: 'yes' }).length, 1);
    assert.equal(errorsFor({ message: 5 }).length, 1);
    assert.equal(errorsFor({ ping: '@everyone' }).length, 1);
    assert.equal(validateWelcomeSettings({ hello: {} }, guild).errors.length, 1);
    assert.equal(validateWelcomeSettings({ welcome: 'on' }, guild).errors.length, 1);
});

// ---------- Tickets ----------

const CATEGORY = '100000000000000009';
const ticketGuild = { ...guild, categoryIds: new Set([CATEGORY]) };
const validateTickets = (input, current = { categoryId: null }) => validateTicketSettings(input, ticketGuild, current);

test('tickets: valid settings map onto the config, panel text as dotted keys', () => {
    assert.deepEqual(
        validateTickets({
            enabled: true,
            categoryId: CATEGORY,
            transcriptChannelId: TEXT,
            staffRoleIds: [ROLE_HIGH, ROLE_HIGH, ROLE_BOT],
            maxOpenPerUser: 2,
            openMessage: '  Hi!  ',
            panel: { title: '  Need   help? ', description: 'Line one\nLine two', buttonLabel: '' },
        }),
        {
            settings: {
                enabled: true,
                categoryId: CATEGORY,
                transcriptChannelId: TEXT,
                staffRoleIds: [ROLE_HIGH, ROLE_BOT],
                maxOpenPerUser: 2,
                openMessage: 'Hi!',
                'panel.title': 'Need help?',
                'panel.description': 'Line one\nLine two',
                'panel.buttonLabel': null,
            },
            errors: [],
        }
    );
});

test('tickets: need a category to be on (new or already saved)', () => {
    assert.match(validateTickets({ enabled: true }).errors[0], /category/);
    assert.equal(validateTickets({ enabled: true }, { categoryId: CATEGORY }).errors.length, 0);
    assert.match(validateTickets({ categoryId: TEXT }).errors[0], /category/, 'a text channel is not a category');
});

test('tickets: limits and unknown keys', () => {
    const errorsFor = (input) => validateTickets(input).errors;
    assert.equal(errorsFor({ maxOpenPerUser: 6 }).length, 1);
    assert.equal(errorsFor({ maxOpenPerUser: 0 }).length, 1);
    assert.equal(errorsFor({ staffRoleIds: Array(11).fill(ROLE_LOW) }).length, 1);
    assert.equal(errorsFor({ staffRoleIds: [OTHER_SERVER_ID] }).length, 1);
    assert.equal(errorsFor({ transcriptChannelId: VOICE }).length, 1);
    assert.equal(errorsFor({ panel: { buttonLabel: 'x'.repeat(81) } }).length, 1);
    assert.equal(errorsFor({ panel: { channelId: TEXT } }).length, 1, 'the panel channel is set by posting it');
    assert.equal(errorsFor({ lastTicketNumber: 0 }).length, 1, 'the counter cannot be changed');
    assert.equal(errorsFor({ pingStaff: 'yes' }).length, 1);
});

// ---------- Ticket types ----------

const EMOJI_ID = '800000000000000001';
const typeGuild = { ...ticketGuild, emojiIds: new Set([EMOJI_ID]) };
const ticketType = (overrides = {}) => ({
    id: 'support1',
    label: '  Ticket   Support ',
    emoji: '🎫',
    style: 'primary',
    description: 'Questions',
    channelPrefix: ' Unban Requests! ',
    categoryId: CATEGORY,
    staffRoleIds: [ROLE_LOW],
    allowedRoleIds: [],
    openMessage: null,
    ...overrides,
});
const validateTypes = (types) => validateTicketSettings({ ticketTypes: types }, typeGuild, { categoryId: null });

test('ticket types: valid types are cleaned up (label spacing, channel name)', () => {
    const { settings, errors } = validateTypes([ticketType()]);
    assert.deepEqual(errors, []);
    assert.deepEqual(settings.ticketTypes[0], {
        id: 'support1',
        label: 'Ticket Support',
        emoji: '🎫',
        style: 'primary',
        description: 'Questions',
        channelPrefix: 'unban-requests',
        categoryId: CATEGORY,
        staffRoleIds: [ROLE_LOW],
        allowedRoleIds: [],
        openMessage: null,
    });
});

test('ticket types: at most 10, unique IDs, and every field checked', () => {
    const errorsFor = (overrides) => validateTypes([ticketType(overrides)]).errors;
    assert.equal(validateTypes(Array.from({ length: 11 }, (_, i) => ticketType({ id: `t${i}` }))).errors.length, 1);
    assert.equal(validateTypes([ticketType(), ticketType()]).errors.length, 1, 'duplicate IDs');
    assert.equal(errorsFor({ id: 'Bad ID!' }).length, 1);
    assert.equal(errorsFor({ label: '   ' }).length, 1);
    assert.equal(errorsFor({ label: 'x'.repeat(81) }).length, 1);
    assert.equal(errorsFor({ style: 'pink' }).length, 1);
    assert.equal(errorsFor({ channelPrefix: '!!!' }).length, 1);
    assert.equal(errorsFor({ categoryId: TEXT }).length, 1);
    assert.equal(errorsFor({ staffRoleIds: [OTHER_SERVER_ID] }).length, 1);
    assert.equal(errorsFor({ allowedRoleIds: 'everyone' }).length, 1);
    assert.equal(errorsFor({ extra: true }).length, 1);
    assert.equal(errorsFor({ description: 'x'.repeat(101) }).length, 1);
});

test('button emojis: one Unicode emoji, or one of this server’s custom emojis', () => {
    const ok = (value) => parseButtonEmoji(value, typeGuild.emojiIds).ok;
    for (const emoji of [
        '🎫',
        '🛠️',
        '❤️',
        '👍🏽',
        '🇬🇧',
        '1️⃣',
        `<:mushroom:${EMOJI_ID}>`,
        `<a:spin:${EMOJI_ID}>`,
        null,
        '',
    ]) {
        assert.equal(ok(emoji), true, String(emoji));
    }
    for (const emoji of ['🎫🎫', 'abc', ':smile:', '<:other:900000000000000009>', '<script>', '1', 42]) {
        assert.equal(ok(emoji), false, String(emoji));
    }
});

// ---------- Stream notifications ----------

test('following a streamer: platform, what to look up, a channel the bot can post in, and an optional ping', () => {
    assert.deepEqual(
        validateStreamAdd({ platform: 'twitch', query: ' shroud ', channelId: TEXT, roleId: 'everyone' }, guild),
        {
            settings: { platform: 'twitch', query: 'shroud', channelId: TEXT, roleId: 'everyone' },
            errors: [],
        }
    );
    const errorsFor = (input) =>
        validateStreamAdd({ platform: 'twitch', query: 'x', channelId: TEXT, ...input }, guild).errors;
    assert.equal(errorsFor({ platform: 'facebook' }).length, 1);
    assert.equal(errorsFor({ query: '   ' }).length, 1);
    assert.equal(errorsFor({ query: 'x'.repeat(101) }).length, 1);
    assert.equal(errorsFor({ channelId: VOICE }).length, 1);
    assert.equal(errorsFor({ roleId: OTHER_SERVER_ID }).length, 1);
});

test('stream settings: only followed streamers, each field checked', () => {
    const ID = 'a'.repeat(24);
    const existing = new Map([[ID, 'shroud']]);
    const update = (overrides = {}) => ({
        id: ID,
        channelId: TEXT,
        roleId: null,
        liveMessage: ' Live! ',
        videoMessage: null,
        notifyLive: true,
        notifyVideos: false,
        ...overrides,
    });

    assert.deepEqual(validateStreamUpdates([update()], guild, existing).settings[0].liveMessage, 'Live!');
    const errorsFor = (overrides) => validateStreamUpdates([update(overrides)], guild, existing).errors;
    assert.match(errorsFor({ id: 'b'.repeat(24) })[0], /no longer followed/);
    assert.equal(errorsFor({ channelId: VOICE }).length, 1);
    assert.equal(errorsFor({ roleId: 'nope' }).length, 1);
    assert.equal(errorsFor({ liveMessage: 'x'.repeat(501) }).length, 1);
    assert.equal(errorsFor({ notifyLive: 'yes' }).length, 1);
    assert.equal(errorsFor({ guildId: 'x' }).length, 1);
    assert.equal(validateStreamUpdates([], guild, existing).errors.length, 1);
});

// ---------- Automatic moderation ----------

test('automatic actions: one per warning count, sorted, mutes need a length Discord allows', () => {
    const HOUR = 3_600_000;
    assert.deepEqual(
        validateModerationSettings({
            warnActions: [
                { warnings: 5, action: 'kick', durationMs: HOUR },
                { warnings: 3, action: 'mute', durationMs: HOUR },
            ],
        }),
        {
            settings: {
                warnActions: [
                    { warnings: 3, action: 'mute', durationMs: HOUR },
                    { warnings: 5, action: 'kick', durationMs: null },
                ],
            },
            errors: [],
        }
    );

    const errorsFor = (warnActions) => validateModerationSettings({ warnActions }).errors;
    assert.equal(errorsFor([{ warnings: 0, action: 'ban' }]).length, 1);
    assert.equal(errorsFor([{ warnings: 51, action: 'ban' }]).length, 1);
    assert.equal(errorsFor([{ warnings: 2.5, action: 'ban' }]).length, 1);
    assert.equal(errorsFor([{ warnings: 3, action: 'nuke' }]).length, 1);
    assert.equal(errorsFor([{ warnings: 3, action: 'mute' }]).length, 1, 'a mute needs a length');
    assert.equal(errorsFor([{ warnings: 3, action: 'mute', durationMs: 29 * 24 * HOUR }]).length, 1);
    assert.match(
        errorsFor([
            { warnings: 3, action: 'kick' },
            { warnings: 3, action: 'ban' },
        ])[0],
        /already an action at 3 warnings/
    );
    assert.equal(errorsFor([{ warnings: 3, action: 'ban', role: 'x' }]).length, 1, 'unknown fields are refused');
    assert.equal(errorsFor(Array.from({ length: 11 }, (_, i) => ({ warnings: i + 1, action: 'ban' }))).length, 1);
    assert.equal(validateModerationSettings({ warnActions: [], extra: 1 }).errors.length, 1);
    assert.equal(validateModerationSettings('nope').errors.length, 1);
});
