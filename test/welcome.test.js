import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Collection } from 'discord.js';
import Welcome_Cache from '../src/features/welcome/cache/welcome.cache.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';
import { buildMessage, fillPlaceholders, DEFAULT_MESSAGES } from '../src/features/welcome/utils/welcomeMessage.js';
import { sendWelcome } from '../src/features/welcome/utils/sendWelcome.js';

const values = { id: '42', username: 'cool_name', displayName: 'Cool', serverName: 'Drift *Kings*', memberCount: 1234 };

/**
 * @param {{ bot?: boolean, memberCount?: number }} [options]
 */
function makeMember({ bot = false, memberCount = 1234 } = {}) {
    return {
        id: '42',
        displayName: 'Cool',
        user: { username: 'cool_name', displayName: 'Cool', bot },
        guild: { id: 'g1', name: 'Drift *Kings*', memberCount },
        displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/42/a.png',
    };
}

const settings = (overrides = {}) => ({
    enabled: true,
    channelId: 'c1',
    message: null,
    embed: false,
    title: null,
    ...overrides,
});

// ---------- Placeholders and message building ----------

test('placeholders are filled, with names escaped so they cannot add formatting', () => {
    assert.equal(
        fillPlaceholders('Hi {user} ({username}, {displayName}) to {server}! #{memberCount} {unknown}', values),
        'Hi <@42> (cool\\_name, Cool) to Drift \\*Kings\\*! #1,234 {unknown}'
    );
});

test('text that looks like a placeholder inside a name is not replaced again', () => {
    assert.equal(fillPlaceholders('{username}', { ...values, username: '{server}' }), '{server}');
});

test('welcome messages ping only the new member, never @everyone or roles', () => {
    const message = buildMessage(
        'welcome',
        settings({ message: '@everyone say hi to {user} <@&1>' }),
        makeMember(),
        '#ff00aa'
    );
    assert.equal(message.content, '@everyone say hi to <@42> <@&1>');
    assert.deepEqual(message.allowedMentions, { parse: [], users: ['42'] });
});

test('goodbye messages never ping anyone', () => {
    const message = buildMessage('goodbye', settings({ message: 'Bye {user}' }), makeMember(), '#ff00aa');
    assert.deepEqual(message.allowedMentions, { parse: [], users: [] });
});

test('an empty message uses the default text', () => {
    const message = buildMessage('goodbye', settings(), makeMember({ memberCount: 9 }), '#ff00aa');
    assert.equal(message.content, fillPlaceholders(DEFAULT_MESSAGES.goodbye, { ...values, memberCount: 9 }));
});

test('embeds use the server colour, the avatar and the title, and mention the member above to ping them', () => {
    const message = buildMessage(
        'welcome',
        settings({ embed: true, title: 'Welcome {displayName}!', message: 'Glad you are here' }),
        makeMember(),
        '#ff00aa'
    );
    const embed = message.embeds[0].toJSON();
    assert.equal(message.content, '<@42>');
    assert.equal(embed.color, 0xff00aa);
    assert.equal(embed.title, 'Welcome Cool!');
    assert.equal(embed.description, 'Glad you are here');
    assert.equal(embed.thumbnail.url, 'https://cdn.discordapp.com/avatars/42/a.png');
});

test('long results are cut to fit Discord limits', () => {
    const long = '{server}'.repeat(400);
    assert.equal(buildMessage('welcome', settings({ message: long }), makeMember(), '#000000').content.length, 2000);
});

// ---------- Sending ----------

let config;
let sent;

beforeEach(() => {
    config = { guildId: 'g1', welcome: settings(), goodbye: settings({ enabled: false }) };
    sent = [];
    Welcome_Cache.get = async () => config;
    Guild_Settings_Cache.get = async (guildId) => ({ guildId, embedColour: null, bio: null });
});

/**
 * A member in a guild whose welcome channel can be controlled.
 * @param {{ bot?: boolean, channel?: boolean, canPost?: boolean }} [options]
 */
function memberInGuild({ bot = false, channel = true, canPost = true } = {}) {
    const member = makeMember({ bot });
    const welcomeChannel = {
        name: 'welcome',
        isTextBased: () => true,
        send: async (payload) => void sent.push(payload),
    };
    member.guild = {
        ...member.guild,
        channels: { cache: new Collection(channel ? [['c1', welcomeChannel]] : []) },
        members: { me: { permissionsIn: () => ({ has: () => canPost }) } },
    };
    return member;
}

test('a welcome message is sent to the chosen channel', async () => {
    assert.equal(await sendWelcome('welcome', memberInGuild()), true);
    assert.equal(sent.length, 1);
});

test('nothing is sent for bots, when switched off, or when the channel cannot be used', async () => {
    assert.equal(await sendWelcome('welcome', memberInGuild({ bot: true })), false);
    assert.equal(await sendWelcome('goodbye', memberInGuild()), false, 'goodbye is off');
    assert.equal(await sendWelcome('welcome', memberInGuild({ channel: false })), false);
    assert.equal(await sendWelcome('welcome', memberInGuild({ canPost: false })), false);
    assert.equal(sent.length, 0);
});
