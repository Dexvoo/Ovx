import { StreamSubscription } from '../models/streamSubscription.js';
import { PlatformError } from './http.js';
import * as twitch from './platforms/twitch.js';
import * as kick from './platforms/kick.js';
import * as youtube from './platforms/youtube.js';
import { isPremium } from '../../../shared/cache/guildSettings.cache.js';
import { LogData } from '../../../shared/utils/logger.js';

/** How many streamers a server can follow (across all platforms). */
export const STREAM_LIMITS = Object.freeze({ FREE: 5, PREMIUM: 50 });

export const STREAM_PLATFORMS = /** @type {const} */ (['twitch', 'youtube', 'kick']);

const clients = { twitch, youtube, kick };

/**
 * Which platforms work with the keys in .env.
 */
export function platformStatus() {
    return {
        twitch: twitch.isConfigured(),
        kick: kick.isConfigured(),
        youtube: true,
        youtubeLive: youtube.canDetectLive(),
    };
}

/**
 * @param {string} guildId
 * @returns {Promise<{ used: number, max: number, premium: boolean }>}
 */
export async function streamLimit(guildId) {
    const [used, premium] = await Promise.all([StreamSubscription.countDocuments({ guildId }), isPremium(guildId)]);
    return { used, max: premium ? STREAM_LIMITS.PREMIUM : STREAM_LIMITS.FREE, premium };
}

/**
 * What the dashboard and /streams show for a subscription (none of the internal tracking fields).
 * @param {any} subscription
 */
export function subscriptionView(subscription) {
    return {
        id: String(subscription._id),
        platform: subscription.platform,
        account: {
            id: subscription.accountId,
            name: subscription.accountName,
            displayName: subscription.displayName,
            avatar: subscription.avatar ?? null,
            url: subscription.url,
        },
        channelId: subscription.channelId,
        roleId: subscription.roleId ?? null,
        liveMessage: subscription.liveMessage ?? null,
        videoMessage: subscription.videoMessage ?? null,
        notifyLive: subscription.notifyLive !== false,
        notifyVideos: subscription.notifyVideos !== false,
    };
}

/**
 * @typedef {{ ok: true, subscription: ReturnType<typeof subscriptionView> } |
 *   { ok: false, reason: 'not_configured' | 'limit' | 'not_found' | 'duplicate' | 'platform_error', max?: number, premium?: boolean }} AddResult
 */

/**
 * Follows a streamer: looks the account up on the platform, then saves the subscription.
 * Channel and role must already be checked.
 * @param {{ guildId: string, platform: 'twitch' | 'youtube' | 'kick', query: string, channelId: string, roleId?: string | null }} options
 * @returns {Promise<AddResult>}
 */
export async function addSubscription({ guildId, platform, query, channelId, roleId = null }) {
    const client = clients[platform];
    if (!client.isConfigured()) return { ok: false, reason: 'not_configured' };

    const limit = await streamLimit(guildId);
    if (limit.used >= limit.max) return { ok: false, reason: 'limit', max: limit.max, premium: limit.premium };

    let account;
    try {
        account = await client.resolveAccount(query);
    } catch (error) {
        if (!(error instanceof PlatformError)) throw error;
        LogData('Streams', `Looking up "${query}" on ${platform} failed: ${error.message}`, 'warning');
        return { ok: false, reason: 'platform_error' };
    }
    if (!account) return { ok: false, reason: 'not_found' };

    try {
        const created = await StreamSubscription.create({
            guildId,
            platform,
            accountId: account.id,
            accountName: account.name,
            displayName: account.displayName,
            avatar: account.avatar,
            url: account.url,
            channelId,
            roleId,
            // YouTube live needs an API key; without one only videos are announced
            notifyLive: platform !== 'youtube' || youtube.canDetectLive(),
        });
        return { ok: true, subscription: subscriptionView(created.toObject()) };
    } catch (error) {
        if (error?.code === 11000) return { ok: false, reason: 'duplicate' }; // Already followed (unique index)
        throw error;
    }
}

/**
 * @param {string} guildId
 * @param {'twitch' | 'youtube' | 'kick'} [platform] - Left out: every platform
 */
export async function listSubscriptions(guildId, platform) {
    const subscriptions = await StreamSubscription.find(platform ? { guildId, platform } : { guildId })
        .sort({ createdAt: 1 })
        .lean();
    return subscriptions.map(subscriptionView);
}
