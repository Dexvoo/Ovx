import { PermissionFlagsBits } from 'discord.js';
import { StreamSubscription } from '../models/streamSubscription.js';
import { buildNotification } from './notification.js';
import * as twitch from './platforms/twitch.js';
import * as kick from './platforms/kick.js';
import * as youtube from './platforms/youtube.js';
import { LogData } from '../../../shared/utils/logger.js';

/** How often each platform is checked. */
export const POLL_INTERVALS = Object.freeze({ twitch: 2 * 60_000, kick: 2 * 60_000, youtube: 5 * 60_000 });

/** Videos older than this are never announced (e.g. the previous video, after the newest was deleted). */
const VIDEO_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const POST_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
];

/**
 * Starts checking the streamers followed by servers on this shard.
 * Each shard only checks its own servers, so nothing is posted twice.
 * @param {import('discord.js').Client} client
 * @returns {() => void} Stops checking
 */
export function startStreamPoller(client) {
    const running = new Set();
    const timers = [];

    for (const [platform, interval] of Object.entries(POLL_INTERVALS)) {
        const run = async () => {
            if (running.has(platform)) return; // The last check is still going
            running.add(platform);
            try {
                await pollPlatform(client, /** @type {any} */ (platform));
            } catch (error) {
                LogData('Streams', `${platform} check failed: ${error.message}`, 'warning');
            } finally {
                running.delete(platform);
            }
        };
        // The first check waits a little, so it doesn't add to startup work
        timers.push(setTimeout(run, 15_000).unref(), setInterval(run, interval).unref());
    }

    return () => timers.forEach((timer) => clearInterval(timer));
}

/**
 * Checks one platform for every subscription on this shard and posts what's new.
 * @param {import('discord.js').Client} client
 * @param {'twitch' | 'kick' | 'youtube'} platform
 */
export async function pollPlatform(client, platform) {
    const module = { twitch, kick, youtube }[platform];
    if (!module.isConfigured()) return;

    const guildIds = [...client.guilds.cache.keys()];
    if (guildIds.length === 0) return;
    const subscriptions = await StreamSubscription.find({ platform, guildId: { $in: guildIds } }).lean();
    if (subscriptions.length === 0) return;

    // Kick is looked up by slug, the others by ID
    const key = (subscription) => (platform === 'kick' ? subscription.accountName : subscription.accountId);
    const accounts = [...new Set(subscriptions.map(key))];

    if (platform === 'youtube') {
        const updates = await youtube.getUpdates(accounts);
        for (const subscription of subscriptions) {
            const update = updates.get(key(subscription));
            if (!update) continue;
            if (update.live && subscription.notifyLive) await announceLive(client, subscription, update.live);
            if (subscription.notifyVideos) await announceVideo(client, subscription, update.latestVideo);
        }
        return;
    }

    const live = await /** @type {any} */ (module).getLiveStreams(accounts);
    for (const subscription of subscriptions) {
        const stream = live.get(key(subscription));
        if (stream && subscription.notifyLive) await announceLive(client, subscription, stream);
    }
}

/**
 * Posts a live notification once per stream.
 * @param {import('discord.js').Client} client
 * @param {any} subscription
 * @param {import('./notification.js').LiveStream} stream
 */
async function announceLive(client, subscription, stream) {
    if (subscription.lastLiveId === stream.id) return;
    // Claimed first, so overlapping checks can't post the same stream twice
    const claimed = await StreamSubscription.findOneAndUpdate(
        { _id: subscription._id, lastLiveId: { $ne: stream.id } },
        { $set: { lastLiveId: stream.id } }
    );
    if (!claimed) return;
    await post(client, subscription, buildNotification('live', subscription, stream));
}

/**
 * Posts a new video once. The first check after following a channel only records its newest video,
 * so following a channel doesn't post an old video.
 * @param {import('discord.js').Client} client
 * @param {any} subscription
 * @param {import('./notification.js').Video | null} video
 */
async function announceVideo(client, subscription, video) {
    if (subscription.lastVideoId === null) {
        await StreamSubscription.updateOne(
            { _id: subscription._id, lastVideoId: null },
            { $set: { lastVideoId: video?.id ?? '', lastVideoAt: video?.publishedAt ?? new Date() } }
        );
        return;
    }
    if (!video || video.id === subscription.lastVideoId) return;

    const published = video.publishedAt?.getTime() ?? 0;
    const isNewer = !subscription.lastVideoAt || published > new Date(subscription.lastVideoAt).getTime();
    if (!isNewer || Date.now() - published > VIDEO_MAX_AGE_MS) return;

    const claimed = await StreamSubscription.findOneAndUpdate(
        { _id: subscription._id, lastVideoId: subscription.lastVideoId },
        { $set: { lastVideoId: video.id, lastVideoAt: video.publishedAt } }
    );
    if (!claimed) return;
    await post(client, subscription, buildNotification('video', subscription, video));
}

/**
 * Sends a notification to the subscription's channel, if the bot can still post there.
 * @param {import('discord.js').Client} client
 * @param {any} subscription
 * @param {import('discord.js').MessageCreateOptions} message
 */
export async function post(client, subscription, message) {
    const guild = client.guilds.cache.get(subscription.guildId);
    const channel = guild?.channels.cache.get(subscription.channelId);
    if (!guild || !channel?.isTextBased()) {
        LogData(
            'Streams',
            `Guild: ${guild?.name ?? subscription.guildId} | The notification channel no longer exists`,
            'warning'
        );
        return false;
    }
    if (!guild.members.me?.permissionsIn(channel).has(POST_PERMISSIONS)) {
        LogData('Streams', `Guild: ${guild.name} | Missing permissions to post in #${channel.name}`, 'warning');
        return false;
    }
    try {
        await channel.send(message);
        return true;
    } catch (error) {
        LogData('Streams', `Guild: ${guild.name} | Could not post a notification: ${error.message}`, 'error');
        return false;
    }
}
