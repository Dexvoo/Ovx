import { ENV } from '../../../../bootstrap/environment.js';
import { PlatformError, requestJson, tokenCache, chunk } from '../http.js';

/**
 * Kick, through its official public API with an app access token (client credentials).
 * https://docs.kick.com
 */

const SLUG = /^[a-zA-Z0-9_-]{3,25}$/;

const token = tokenCache(async () => {
    const { CLIENT_ID, CLIENT_SECRET } = ENV.STREAMS.KICK;
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
    });
    const result = await requestJson('https://id.kick.com/oauth/token', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return { token: result.access_token, expiresInSeconds: result.expires_in };
});

export function isConfigured() {
    return Boolean(ENV.STREAMS.KICK);
}

/**
 * @param {string} path - e.g. /channels
 * @param {[string, string][]} params
 */
async function api(path, params, retried = false) {
    const url = new URL(`https://api.kick.com/public/v1${path}`);
    for (const [key, value] of params) url.searchParams.append(key, value);
    try {
        return await requestJson(url, {
            headers: { Authorization: `Bearer ${await token.get()}`, Accept: 'application/json' },
        });
    } catch (error) {
        if (error instanceof PlatformError && error.status === 401 && !retried) {
            token.clear();
            return api(path, params, true);
        }
        throw error;
    }
}

/**
 * Finds a Kick channel from what someone typed: a username or a kick.com link.
 * @param {string} input
 * @returns {Promise<import('../notification.js').StreamAccount | null>}
 */
export async function resolveAccount(input) {
    const slug = input
        .trim()
        .replace(/^https?:\/\/(www\.)?kick\.com\//i, '')
        .replace(/^@/, '')
        .split(/[/?#]/)[0];
    if (!SLUG.test(slug)) return null;

    const { data } = await api('/channels', [['slug', slug.toLowerCase()]]);
    const channel = data?.[0];
    if (!channel) return null;

    // The profile picture comes from the user, not the channel
    const users = await api('/users', [['id', String(channel.broadcaster_user_id)]]).catch(() => null);
    const user = users?.data?.[0];
    return {
        id: String(channel.broadcaster_user_id),
        name: channel.slug,
        displayName: user?.name ?? channel.slug,
        avatar: user?.profile_picture ?? null,
        url: `https://kick.com/${channel.slug}`,
    };
}

/**
 * Which of these channels are live right now.
 * @param {string[]} slugs - Kick looks channels up by slug
 * @returns {Promise<Map<string, import('../notification.js').LiveStream>>} Keyed by slug; only live channels
 */
export async function getLiveStreams(slugs) {
    const live = new Map();
    for (const batch of chunk(slugs, 50)) {
        const { data } = await api(
            '/channels',
            batch.map((slug) => /** @type {[string, string]} */ (['slug', slug]))
        );
        for (const channel of data ?? []) {
            const stream = channel.stream;
            if (!stream?.is_live) continue;
            live.set(channel.slug, {
                // Kick has no stream ID here; the start time is unique per stream
                id: `${channel.broadcaster_user_id}:${stream.start_time}`,
                title: channel.stream_title || 'Untitled stream',
                game: channel.category?.name || null,
                viewers: stream.viewer_count ?? null,
                startedAt: stream.start_time ? new Date(stream.start_time) : null,
                thumbnail: stream.thumbnail
                    ? `${stream.thumbnail}${stream.thumbnail.includes('?') ? '&' : '?'}t=${Date.now()}`
                    : null,
                url: `https://kick.com/${channel.slug}`,
            });
        }
    }
    return live;
}
