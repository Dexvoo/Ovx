import { ENV } from '../../../../bootstrap/environment.js';
import { PlatformError, requestJson, tokenCache, chunk } from '../http.js';

/**
 * Twitch, through the Helix API with an app access token (client credentials).
 * https://dev.twitch.tv/docs/api/reference
 */

const LOGIN = /^[a-zA-Z0-9_]{3,25}$/;

const token = tokenCache(async () => {
    const { CLIENT_ID, CLIENT_SECRET } = ENV.STREAMS.TWITCH;
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
    });
    const result = await requestJson('https://id.twitch.tv/oauth2/token', { method: 'POST', body });
    return { token: result.access_token, expiresInSeconds: result.expires_in };
});

export function isConfigured() {
    return Boolean(ENV.STREAMS.TWITCH);
}

/**
 * @param {string} path - e.g. /users
 * @param {[string, string][]} params - Repeated keys are allowed (user_id=1&user_id=2)
 */
async function helix(path, params, retried = false) {
    const url = new URL(`https://api.twitch.tv/helix${path}`);
    for (const [key, value] of params) url.searchParams.append(key, value);
    try {
        return await requestJson(url, {
            headers: { 'Client-Id': ENV.STREAMS.TWITCH.CLIENT_ID, Authorization: `Bearer ${await token.get()}` },
        });
    } catch (error) {
        // An expired or revoked token: get a new one and try once more
        if (error instanceof PlatformError && error.status === 401 && !retried) {
            token.clear();
            return helix(path, params, true);
        }
        throw error;
    }
}

/**
 * Finds a Twitch channel from what someone typed: a username or a twitch.tv link.
 * @param {string} input
 * @returns {Promise<import('../notification.js').StreamAccount | null>}
 */
export async function resolveAccount(input) {
    const login = input
        .trim()
        .replace(/^https?:\/\/(www\.|m\.)?twitch\.tv\//i, '')
        .replace(/^@/, '')
        .split(/[/?#]/)[0];
    if (!LOGIN.test(login)) return null;

    const { data } = await helix('/users', [['login', login.toLowerCase()]]);
    const user = data?.[0];
    if (!user) return null;
    return {
        id: user.id,
        name: user.login,
        displayName: user.display_name,
        avatar: user.profile_image_url ?? null,
        url: `https://www.twitch.tv/${user.login}`,
    };
}

/**
 * Which of these channels are live right now.
 * @param {string[]} userIds
 * @returns {Promise<Map<string, import('../notification.js').LiveStream>>} Only live channels are included
 */
export async function getLiveStreams(userIds) {
    const live = new Map();
    for (const ids of chunk(userIds, 100)) {
        const { data } = await helix('/streams', [
            ['type', 'live'],
            ['first', '100'],
            ...ids.map((id) => /** @type {[string, string]} */ (['user_id', id])),
        ]);
        for (const stream of data ?? []) {
            live.set(stream.user_id, {
                id: stream.id,
                title: stream.title || 'Untitled stream',
                game: stream.game_name || null,
                viewers: stream.viewer_count ?? null,
                startedAt: stream.started_at ? new Date(stream.started_at) : null,
                // The time stops Discord showing an old cached thumbnail
                thumbnail: stream.thumbnail_url
                    ? `${stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?t=${Date.now()}`
                    : null,
                url: `https://www.twitch.tv/${stream.user_login}`,
            });
        }
    }
    return live;
}
