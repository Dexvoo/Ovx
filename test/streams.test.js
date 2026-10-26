import { test, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Collection } from 'discord.js';
import { stubEnvironment } from './helpers/env.js';

const GUILD_ID = '400000000000000001';
const CHANNEL_ID = '500000000000000001';
const ROLE_ID = '600000000000000001';

/** @type {any} */ let notification;
/** @type {any} */ let poller;
/** @type {any} */ let youtube;
/** @type {any} */ let subscriptions;
/** @type {any} */ let StreamSubscription;
/** @type {any} */ let Guild_Settings_Cache;

const realFetch = globalThis.fetch;
/** @type {Map<string, any>} URL prefix → JSON or text response */
let responses;
let requested;

before(async () => {
    // Twitch keys turn Twitch on; YouTube live needs the API key
    stubEnvironment({
        TWITCH_CLIENT_ID: 'twitch-id',
        TWITCH_CLIENT_SECRET: 'twitch-secret',
        YOUTUBE_API_KEY: 'yt-key',
    });
    notification = await import('../src/features/streams/utils/notification.js');
    poller = await import('../src/features/streams/utils/poller.js');
    youtube = await import('../src/features/streams/utils/platforms/youtube.js');
    subscriptions = await import('../src/features/streams/utils/subscriptions.js');
    ({ StreamSubscription } = await import('../src/features/streams/models/streamSubscription.js'));
    ({ default: Guild_Settings_Cache } = await import('../src/shared/cache/guildSettings.cache.js'));
});

beforeEach(() => {
    responses = new Map([['https://id.twitch.tv/oauth2/token', { access_token: 'token', expires_in: 3600 }]]);
    requested = [];
    globalThis.fetch = async (url) => {
        const href = String(url);
        requested.push(href);
        const match = [...responses.keys()].find((prefix) => href.startsWith(prefix));
        if (!match) return new Response('not found', { status: 404 });
        const body = responses.get(match);
        return typeof body === 'string' ? new Response(body) : Response.json(body);
    };
    Guild_Settings_Cache.get = async (guildId) => ({ guildId, embedColour: null, bio: null, premiumUntil: null });
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

const subscription = (overrides = {}) => ({
    _id: 'sub1',
    guildId: GUILD_ID,
    platform: 'twitch',
    accountId: '1001',
    accountName: 'shroud',
    displayName: 'shroud',
    avatar: 'https://example.com/a.png',
    url: 'https://www.twitch.tv/shroud',
    channelId: CHANNEL_ID,
    roleId: null,
    liveMessage: null,
    videoMessage: null,
    notifyLive: true,
    notifyVideos: true,
    lastLiveId: null,
    lastVideoId: null,
    lastVideoAt: null,
    ...overrides,
});
const stream = {
    id: 's1',
    title: 'Ranked *grind*',
    game: 'VALORANT',
    viewers: 1234,
    startedAt: new Date(),
    thumbnail: null,
    url: 'https://www.twitch.tv/shroud',
};

// ---------- Messages ----------

test('live notifications fill placeholders safely and ping only the chosen role', () => {
    const message = notification.buildNotification(
        'live',
        subscription({ roleId: ROLE_ID, liveMessage: '{streamer} is playing {game}: {title} @everyone' }),
        stream
    );
    assert.equal(message.content, `<@&${ROLE_ID}> shroud is playing VALORANT: Ranked \\*grind\\* @everyone`);
    assert.deepEqual(message.allowedMentions, { parse: [], roles: [ROLE_ID] }, 'the typed @everyone does not ping');

    const embed = message.embeds[0].toJSON();
    assert.equal(embed.color, 0x9146ff);
    assert.equal(embed.url, stream.url);
    assert.deepEqual(
        embed.fields.map((field) => field.name),
        ['Playing', 'Viewers']
    );
    assert.equal(message.components[0].toJSON().components[0].url, stream.url);
});

test('pinging everyone is only possible when chosen, and no role means no ping', () => {
    const everyone = notification.buildNotification('live', subscription({ roleId: 'everyone' }), stream);
    assert.match(everyone.content, /^@everyone /);
    assert.deepEqual(everyone.allowedMentions, { parse: ['everyone'] });

    const none = notification.buildNotification('live', subscription(), stream);
    assert.deepEqual(none.allowedMentions, { parse: [], roles: [] });
    assert.equal(none.content, '**shroud** is live on Twitch!');
});

// ---------- YouTube feed ----------

const feed = (entries) =>
    `<?xml version="1.0"?><feed><title>Mushroom &amp; Friends</title>${entries
        .map(
            ([id, title, published]) =>
                `<entry><yt:videoId>${id}</yt:videoId><title>${title}</title><published>${published}</published><media:thumbnail url="https://i.ytimg.com/vi/${id}/hqdefault.jpg"/></entry>`
        )
        .join('')}</feed>`;

test('YouTube feeds are read without a key, with HTML entities decoded', () => {
    const { channelTitle, entries } = youtube.parseFeed(
        feed([['abcdefghijk', 'Q&amp;A &lt;live&gt;', '2026-10-12T10:00:00+00:00']])
    );
    assert.equal(channelTitle, 'Mushroom & Friends');
    assert.equal(entries[0].title, 'Q&A <live>');
    assert.equal(entries[0].url, 'https://www.youtube.com/watch?v=abcdefghijk');
    assert.ok(entries[0].publishedAt instanceof Date);
});

// ---------- Checking for streams and videos ----------

/**
 * Stubs the database and a client with one guild and a channel that records messages.
 * @param {any[]} subs
 */
function setup(subs) {
    const sent = [];
    const claims = [];
    StreamSubscription.find = () => ({ lean: async () => subs });
    StreamSubscription.findOneAndUpdate = async (filter, update) => {
        const sub = subs.find((s) => s._id === filter._id);
        // Claims fail if another check already announced it (the filter no longer matches)
        if (filter.lastLiveId?.$ne !== undefined && sub.lastLiveId === filter.lastLiveId.$ne) return null;
        if ('lastVideoId' in filter && typeof filter.lastVideoId === 'string' && sub.lastVideoId !== filter.lastVideoId)
            return null;
        claims.push(update.$set);
        Object.assign(sub, update.$set);
        return sub;
    };
    StreamSubscription.updateOne = async (filter, update) => {
        const sub = subs.find((s) => s._id === filter._id);
        if (sub && sub.lastVideoId === null) Object.assign(sub, update.$set);
    };
    const channel = { name: 'streams', isTextBased: () => true, send: async (message) => void sent.push(message) };
    const guild = {
        id: GUILD_ID,
        name: 'Test',
        channels: { cache: new Collection([[CHANNEL_ID, channel]]) },
        members: { me: { permissionsIn: () => ({ has: () => true }) } },
    };
    const client = { guilds: { cache: new Collection([[GUILD_ID, guild]]) } };
    return { client, sent, claims };
}

test('a stream is announced once, then not again until the next stream', async () => {
    const subs = [subscription()];
    const { client, sent } = setup(subs);
    responses.set('https://api.twitch.tv/helix/streams', {
        data: [
            {
                id: 'stream-1',
                user_id: '1001',
                user_login: 'shroud',
                title: 'Hi',
                game_name: 'VALORANT',
                viewer_count: 5,
                started_at: '2026-10-12T10:00:00Z',
                thumbnail_url: 'https://x/{width}x{height}.jpg',
            },
        ],
    });

    await poller.pollPlatform(client, 'twitch');
    await poller.pollPlatform(client, 'twitch');
    assert.equal(sent.length, 1);
    assert.match(sent[0].embeds[0].toJSON().image.url, /1280x720\.jpg\?t=\d+$/);
    assert.ok(requested.some((url) => url.includes('user_id=1001')));

    responses.set('https://api.twitch.tv/helix/streams', {
        data: [{ id: 'stream-2', user_id: '1001', user_login: 'shroud', title: 'Again' }],
    });
    await poller.pollPlatform(client, 'twitch');
    assert.equal(sent.length, 2);
});

test('live notifications that are switched off are not posted', async () => {
    const { client, sent } = setup([subscription({ notifyLive: false })]);
    responses.set('https://api.twitch.tv/helix/streams', {
        data: [{ id: 'x', user_id: '1001', user_login: 'shroud', title: 'Hi' }],
    });
    await poller.pollPlatform(client, 'twitch');
    assert.equal(sent.length, 0);
});

test('YouTube: following a channel does not post its old videos, but later uploads and live streams are posted', async () => {
    const channelId = 'UC' + 'a'.repeat(22);
    const subs = [
        subscription({
            _id: 'yt',
            platform: 'youtube',
            accountId: channelId,
            accountName: channelId,
            url: `https://www.youtube.com/channel/${channelId}`,
        }),
    ];
    const { client, sent } = setup(subs);
    const now = new Date().toISOString();
    responses.set('https://www.googleapis.com/youtube/v3/videos', { items: [] });

    responses.set(
        'https://www.youtube.com/feeds/videos.xml',
        feed([['oldvideo001', 'Old video', '2026-01-01T00:00:00Z']])
    );
    await poller.pollPlatform(client, 'youtube');
    assert.equal(sent.length, 0, 'the first check only remembers the newest video');
    assert.equal(subs[0].lastVideoId, 'oldvideo001');

    responses.set(
        'https://www.youtube.com/feeds/videos.xml',
        feed([
            ['newvideo001', 'New video', now],
            ['oldvideo001', 'Old video', '2026-01-01T00:00:00Z'],
        ])
    );
    await poller.pollPlatform(client, 'youtube');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].embeds[0].toJSON().title, 'New video');

    // A live stream: the newest entry is live, so it's a live notification, not a new video
    responses.set(
        'https://www.youtube.com/feeds/videos.xml',
        feed([
            ['livestream1', 'Live now!', now],
            ['newvideo001', 'New video', now],
        ])
    );
    responses.set('https://www.googleapis.com/youtube/v3/videos', {
        items: [
            {
                id: 'livestream1',
                snippet: { liveBroadcastContent: 'live' },
                liveStreamingDetails: { concurrentViewers: '42', actualStartTime: now },
            },
        ],
    });
    await poller.pollPlatform(client, 'youtube');
    assert.equal(sent.length, 2);
    assert.match(sent[1].content, /is live on YouTube/);
    assert.equal(subs[0].lastVideoId, 'newvideo001', 'the live stream did not count as a new video');
});

test('YouTube: when the newest video is deleted, the previous one is not posted again', async () => {
    const channelId = 'UC' + 'b'.repeat(22);
    const subs = [
        subscription({
            _id: 'yt2',
            platform: 'youtube',
            accountId: channelId,
            accountName: channelId,
            lastVideoId: 'deleted0001',
            lastVideoAt: new Date(),
        }),
    ];
    const { client, sent } = setup(subs);
    responses.set('https://www.googleapis.com/youtube/v3/videos', { items: [] });
    responses.set(
        'https://www.youtube.com/feeds/videos.xml',
        feed([['previous001', 'Previous video', new Date(Date.now() - 3600_000).toISOString()]])
    );
    await poller.pollPlatform(client, 'youtube');
    assert.equal(sent.length, 0);
});

// ---------- Following ----------

test('following looks the account up, and respects the limit (more with premium)', async () => {
    let count = 0;
    StreamSubscription.countDocuments = async () => count;
    StreamSubscription.create = async (doc) => ({ toObject: () => ({ _id: 'new1', ...doc }) });
    responses.set('https://api.twitch.tv/helix/users', {
        data: [{ id: '1001', login: 'shroud', display_name: 'shroud', profile_image_url: 'https://x/a.png' }],
    });

    const add = () =>
        subscriptions.addSubscription({
            guildId: GUILD_ID,
            platform: 'twitch',
            query: 'https://twitch.tv/Shroud',
            channelId: CHANNEL_ID,
        });

    const added = await add();
    assert.equal(added.ok, true);
    assert.equal(added.subscription.account.name, 'shroud');
    assert.ok(
        requested.some((url) => url.includes('login=shroud')),
        'links and capitals are cleaned up'
    );

    count = 5;
    assert.deepEqual(await add(), { ok: false, reason: 'limit', max: 5, premium: false });

    Guild_Settings_Cache.get = async (guildId) => ({ guildId, premiumUntil: new Date(Date.now() + 86400_000) });
    assert.equal((await add()).ok, true, 'premium servers can follow up to 50');
    count = 50;
    assert.equal((await add()).reason, 'limit');
});

test('following an unknown, duplicate or unreachable account says why', async () => {
    StreamSubscription.countDocuments = async () => 0;
    responses.set('https://api.twitch.tv/helix/users', { data: [] });
    const add = (query) =>
        subscriptions.addSubscription({ guildId: GUILD_ID, platform: 'twitch', query, channelId: CHANNEL_ID });

    assert.equal((await add('nobody_here')).reason, 'not_found');
    assert.equal((await add('bad name!')).reason, 'not_found', 'invalid names never reach Twitch');

    responses.set('https://api.twitch.tv/helix/users', { data: [{ id: '1', login: 'a', display_name: 'a' }] });
    StreamSubscription.create = async () => Promise.reject(Object.assign(new Error('dup'), { code: 11000 }));
    assert.equal((await add('someone')).reason, 'duplicate');

    responses.delete('https://api.twitch.tv/helix/users');
    assert.equal((await add('someone')).reason, 'platform_error');
});

test('Kick is off without its keys', async () => {
    StreamSubscription.countDocuments = async () => 0;
    const result = await subscriptions.addSubscription({
        guildId: GUILD_ID,
        platform: 'kick',
        query: 'xqc',
        channelId: CHANNEL_ID,
    });
    assert.equal(result.reason, 'not_configured');
    assert.deepEqual(subscriptions.platformStatus(), { twitch: true, kick: false, youtube: true, youtubeLive: true });
});
