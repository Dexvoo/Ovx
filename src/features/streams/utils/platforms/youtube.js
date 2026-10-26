import { ENV } from '../../../../bootstrap/environment.js';
import { request, requestJson, chunk } from '../http.js';

/**
 * YouTube.
 * - New videos come from each channel's public feed (no key needed).
 * - Live streams need a YouTube Data API key: the newest feed entries are checked with videos.list,
 *   which costs 1 quota unit per 50 videos (the free quota is 10,000 a day).
 */

const CHANNEL_ID = /^UC[\w-]{22}$/;
const HANDLE = /^@?[\w.-]{3,30}$/;
/** How many of each channel's newest videos are checked for a live stream. */
const LIVE_CHECK_COUNT = 3;

export function isConfigured() {
    return true; // New videos always work
}

export function canDetectLive() {
    return Boolean(ENV.STREAMS.YOUTUBE_API_KEY);
}

/**
 * @param {string} path
 * @param {Record<string, string>} params
 */
function dataApi(path, params) {
    const url = new URL(`https://www.googleapis.com/youtube/v3${path}`);
    for (const [key, value] of Object.entries({ ...params, key: ENV.STREAMS.YOUTUBE_API_KEY })) {
        url.searchParams.set(key, value);
    }
    return requestJson(url);
}

/**
 * The parts of a channel feed the bot needs. Feeds are simple, predictable XML, so a few patterns are enough.
 * @param {string} xml
 */
export function parseFeed(xml) {
    const decode = (text) =>
        text
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');
    const field = (block, pattern) => {
        const match = pattern.exec(block);
        return match ? decode(match[1]) : null;
    };

    const channelTitle = field(xml.split('<entry>')[0], /<title>([^<]*)<\/title>/);
    const entries = xml
        .split('<entry>')
        .slice(1)
        .map((block) => ({
            id: field(block, /<yt:videoId>([\w-]{11})<\/yt:videoId>/),
            title: field(block, /<title>([^<]*)<\/title>/) ?? 'Untitled video',
            publishedAt: field(block, /<published>([^<]+)<\/published>/),
            thumbnail: field(block, /<media:thumbnail url="([^"]+)"/),
        }))
        .filter((entry) => entry.id)
        .map((entry) => ({
            ...entry,
            publishedAt: entry.publishedAt ? new Date(entry.publishedAt) : null,
            url: `https://www.youtube.com/watch?v=${entry.id}`,
        }));
    return { channelTitle, entries };
}

/** @param {string} channelId */
async function fetchFeed(channelId) {
    const response = await request(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    return parseFeed(await response.text());
}

/**
 * Finds a YouTube channel from what someone typed: a channel link, a channel ID (UC…), or an @handle.
 * Handles are looked up with the API key if there is one, otherwise from the channel page.
 * @param {string} input
 * @returns {Promise<import('../notification.js').StreamAccount | null>}
 */
export async function resolveAccount(input) {
    const text = input.trim();
    const fromUrl = /youtube\.com\/channel\/(UC[\w-]{22})/i.exec(text)?.[1];
    const handle =
        /youtube\.com\/(@[\w.-]+)/i.exec(text)?.[1] ?? (HANDLE.test(text) && !CHANNEL_ID.test(text) ? text : null);

    let channelId = fromUrl ?? (CHANNEL_ID.test(text) ? text : null);
    let title = null;
    let avatar = null;

    if (!channelId && handle) {
        const withAt = handle.startsWith('@') ? handle : `@${handle}`;
        if (canDetectLive()) {
            const { items } = await dataApi('/channels', { part: 'snippet', forHandle: withAt });
            channelId = items?.[0]?.id ?? null;
            title = items?.[0]?.snippet?.title ?? null;
            avatar = items?.[0]?.snippet?.thumbnails?.default?.url ?? null;
        } else {
            const page = await (await request(`https://www.youtube.com/${encodeURIComponent(withAt)}`)).text();
            channelId = /"(?:channelId|externalId)":"(UC[\w-]{22})"/.exec(page)?.[1] ?? null;
        }
    }
    if (!channelId) return null;

    // The feed confirms the channel exists (and gives its name without a key)
    const feed = await fetchFeed(channelId).catch(() => null);
    if (!feed) return null;
    if (canDetectLive() && !avatar) {
        const { items } = await dataApi('/channels', { part: 'snippet', id: channelId }).catch(() => ({ items: [] }));
        avatar = items?.[0]?.snippet?.thumbnails?.default?.url ?? null;
        title ??= items?.[0]?.snippet?.title ?? null;
    }
    return {
        id: channelId,
        name: channelId,
        displayName: title ?? feed.channelTitle ?? channelId,
        avatar,
        url: `https://www.youtube.com/channel/${channelId}`,
    };
}

/**
 * The newest video (and, with an API key, the current live stream) for each channel.
 * Videos that are or were live streams don't count as new videos when they can be told apart.
 * @param {string[]} channelIds
 * @returns {Promise<Map<string, { latestVideo: import('../notification.js').Video | null,
 *   live: import('../notification.js').LiveStream | null }>>}
 */
export async function getUpdates(channelIds) {
    const feeds = new Map();
    // A few at a time, so a server following many channels doesn't hammer YouTube
    for (const batch of chunk(channelIds, 5)) {
        const results = await Promise.allSettled(batch.map((id) => fetchFeed(id)));
        batch.forEach((id, index) => {
            if (results[index].status === 'fulfilled') feeds.set(id, results[index].value.entries);
        });
    }

    /** @type {Map<string, any>} Video ID → details from the Data API */
    const details = new Map();
    if (canDetectLive()) {
        const ids = [...feeds.values()].flatMap((entries) =>
            entries.slice(0, LIVE_CHECK_COUNT).map((entry) => entry.id)
        );
        for (const batch of chunk(ids, 50)) {
            const { items } = await dataApi('/videos', {
                part: 'snippet,liveStreamingDetails,statistics',
                id: batch.join(','),
            });
            for (const item of items ?? []) details.set(item.id, item);
        }
    }

    const updates = new Map();
    for (const [channelId, entries] of feeds) {
        let live = null;
        let latestVideo = null;
        for (const entry of entries) {
            const info = details.get(entry.id);
            const state = info?.snippet?.liveBroadcastContent; // 'live', 'upcoming' or 'none'
            if (state === 'live' && !live) {
                live = {
                    id: entry.id,
                    title: entry.title,
                    game: null,
                    viewers: info.liveStreamingDetails?.concurrentViewers
                        ? Number(info.liveStreamingDetails.concurrentViewers)
                        : null,
                    startedAt: info.liveStreamingDetails?.actualStartTime
                        ? new Date(info.liveStreamingDetails.actualStartTime)
                        : null,
                    thumbnail: `https://i.ytimg.com/vi/${entry.id}/maxresdefault_live.jpg?t=${Date.now()}`,
                    url: entry.url,
                };
            }
            // Live streams (current, upcoming or past) aren't "new videos"
            const isStream = state === 'live' || state === 'upcoming' || Boolean(info?.liveStreamingDetails);
            if (!latestVideo && !isStream) {
                latestVideo = {
                    id: entry.id,
                    title: entry.title,
                    url: entry.url,
                    thumbnail: entry.thumbnail,
                    publishedAt: entry.publishedAt,
                };
            }
        }
        updates.set(channelId, { latestVideo, live });
    }
    return updates;
}
