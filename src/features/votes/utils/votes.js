import NodeCache from 'node-cache';
import { UserVote } from '../models/userVote.js';
import { ENV } from '../../../bootstrap/environment.js';

/** Top.gg lets someone vote once every 12 hours, so a vote counts for that long. */
export const VOTE_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Whether votes reach Ovx (the dashboard's Top.gg webhook is set up). */
export function votesEnabled() {
    return Boolean(ENV.TOPGG_WEBHOOK_SECRET && ENV.DASHBOARD);
}

/** Where people vote for Ovx. */
export function voteUrl() {
    return `https://top.gg/bot/${ENV.APPLICATION_ID}/vote`;
}

/**
 * @param {string} userId
 * @param {Date} [now]
 * @returns {Promise<number>} Their total votes
 */
export async function recordVote(userId, now = new Date()) {
    const updated = await UserVote.findOneAndUpdate(
        { userId },
        { $inc: { votes: 1 }, $set: { lastVotedAt: now } },
        { upsert: true, returnDocument: 'after' }
    ).lean();
    return updated?.votes ?? 1;
}

/**
 * Whether someone voted in the last 12 hours.
 * @param {string} userId
 * @param {Date} [now]
 */
export async function hasVotedRecently(userId, now = new Date()) {
    if (!votesEnabled()) return false;
    const vote = await UserVote.findOne({ userId }, { lastVotedAt: 1 }).lean();
    return Boolean(vote?.lastVotedAt && now.getTime() - new Date(vote.lastVotedAt).getTime() < VOTE_WINDOW_MS);
}

/** Extra XP for voting: 10%, for 12 hours after a vote. */
export const VOTE_XP_BONUS = 0.1;

/**
 * User ID → when they last voted (0 for never). Checked on every message that earns XP, so it's cached;
 * a new vote clears it straight away on every shard (see forgetVote).
 */
const lastVoteCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 2 * 60 });

/**
 * The XP multiplier for someone: 1.1 if they voted in the last 12 hours, otherwise 1.
 * @param {string} userId
 * @param {number} [now]
 */
export async function voteXPMultiplier(userId, now = Date.now()) {
    if (!votesEnabled()) return 1;
    let lastVotedAt = lastVoteCache.get(userId);
    if (lastVotedAt === undefined) {
        // A database error counts as no vote for a few minutes, rather than holding up XP
        const vote = await UserVote.findOne({ userId }, { lastVotedAt: 1 })
            .lean()
            .catch(() => null);
        lastVotedAt = vote?.lastVotedAt ? new Date(vote.lastVotedAt).getTime() : 0;
        lastVoteCache.set(userId, lastVotedAt);
    }
    return now - /** @type {number} */ (lastVotedAt) < VOTE_WINDOW_MS ? 1 + VOTE_XP_BONUS : 1;
}

/**
 * Drops someone from the cache after they vote, so their bonus starts at once.
 * @param {string} userId
 */
export function forgetVote(userId) {
    lastVoteCache.del(userId);
}
