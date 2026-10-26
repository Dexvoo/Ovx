import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/**
 * A server following one streamer or channel.
 *
 * Each subscription remembers what it last announced, so a stream or video is posted once per server, even
 * with several shards checking or after a restart.
 *
 * @typedef {'twitch' | 'youtube' | 'kick'} StreamPlatform
 *
 * @typedef {Object} StreamSubscriptionType
 * @property {string} guildId
 * @property {StreamPlatform} platform
 * @property {string} accountId - Twitch user ID, YouTube channel ID, or Kick user ID
 * @property {string} accountName - Twitch login, YouTube channel ID, or Kick slug (Kick is looked up by slug)
 * @property {string} displayName
 * @property {string | null} avatar
 * @property {string} url
 * @property {string} channelId - Discord channel notifications are posted in
 * @property {string | null} roleId - Role to ping: a role ID, 'everyone', or null for no ping
 * @property {string | null} liveMessage - null uses the default
 * @property {string | null} videoMessage - null uses the default (YouTube only)
 * @property {boolean} notifyLive
 * @property {boolean} notifyVideos - YouTube only
 * @property {string | null} lastLiveId - The last stream announced
 * @property {string | null} lastVideoId - The newest video seen; null until the first check (so old videos aren't posted)
 * @property {Date | null} lastVideoAt
 * @property {Date} createdAt
 */

const StreamSubscriptionSchema = new Schema({
    guildId: { type: String, required: true },
    platform: { type: String, enum: ['twitch', 'youtube', 'kick'], required: true },
    accountId: { type: String, required: true },
    accountName: { type: String, required: true },
    displayName: { type: String, required: true },
    avatar: { type: String, default: null },
    url: { type: String, required: true },
    channelId: { type: String, required: true },
    roleId: { type: String, default: null },
    liveMessage: { type: String, default: null },
    videoMessage: { type: String, default: null },
    notifyLive: { type: Boolean, default: true },
    notifyVideos: { type: Boolean, default: true },
    lastLiveId: { type: String, default: null },
    lastVideoId: { type: String, default: null },
    lastVideoAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
});

// A server follows each account once; checks look subscriptions up by platform
StreamSubscriptionSchema.index({ guildId: 1, platform: 1, accountId: 1 }, { unique: true });
StreamSubscriptionSchema.index({ platform: 1, guildId: 1 });

export const StreamSubscription = model('Guild-Stream-Subscription', StreamSubscriptionSchema);
