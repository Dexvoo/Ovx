import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { recordVote } from './votes.js';
import { LogData } from '../../../shared/utils/logger.js';

const SNOWFLAKE = /^\d{17,20}$/;
/** A signed request older (or newer) than this is refused, so a captured one can't be replayed later. */
export const SIGNATURE_TOLERANCE_MS = 60 * 60_000;
/** Vote IDs already counted, so a retried delivery isn't counted twice. */
const SEEN_MAX = 10_000;
const seenVotes = new Set();

/** @param {string} value */
const digest = (value) => createHash('sha256').update(value).digest();

/**
 * Whether two strings are equal. Compared as hashes in constant time, so neither the secret nor its
 * length can be worked out from how long the check takes.
 * @param {unknown} given
 * @param {string} expected
 */
function sameSecret(given, expected) {
    if (typeof given !== 'string' || !expected) return false;
    return timingSafeEqual(digest(given), digest(expected));
}

/**
 * Whether the Authorization header is the secret (Top.gg's older "v0" webhooks).
 * @param {unknown} header
 * @param {string} secret
 */
export function isAuthorized(header, secret) {
    return sameSecret(header, secret);
}

/**
 * Checks a Top.gg v1 signature: the header is "t={unix seconds},v1={hex HMAC-SHA256 of `${t}.${rawBody}`}",
 * keyed with the webhook secret (whs_…).
 * @param {unknown} header - x-topgg-signature
 * @param {string | undefined} rawBody - Exactly as received, before JSON parsing
 * @param {string} secret
 * @param {number} [now]
 */
export function isValidSignature(header, rawBody, secret, now = Date.now()) {
    if (typeof header !== 'string' || typeof rawBody !== 'string' || !secret) return false;
    const parts = Object.fromEntries(
        header.split(',').map((part) => {
            const index = part.indexOf('=');
            return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
        })
    );
    const timestamp = Number(parts.t);
    if (!Number.isSafeInteger(timestamp) || !parts.v1) return false;
    if (Math.abs(now - timestamp * 1000) > SIGNATURE_TOLERANCE_MS) return false;

    const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
    return sameSecret(parts.v1.toLowerCase(), expected);
}

/**
 * The vote in either format, or why it's refused.
 * v1: { type: 'vote.create' | 'webhook.test', data: { id, project: { platform_id }, user: { platform_id } } }
 * v0: { bot, user, type: 'upvote' | 'test', isWeekend }
 * @param {any} body
 * @param {boolean} signed - Came with a v1 signature
 * @returns {{ test?: boolean, ignore?: boolean, userId?: string, botId?: string, voteId?: string }}
 */
function readVote(body, signed) {
    if (signed) {
        const { type, data } = body ?? {};
        if (type === 'webhook.test')
            return { test: true, userId: data?.user?.platform_id, botId: data?.project?.platform_id };
        // Events Ovx doesn't use are acknowledged, so Top.gg doesn't keep retrying them
        if (type !== 'vote.create') return { ignore: true };
        return {
            userId: data?.user?.platform_id,
            botId: data?.project?.platform_id,
            voteId: typeof data?.id === 'string' ? data.id : undefined,
        };
    }
    const { user, bot, type } = body ?? {};
    return { test: type === 'test', userId: user, botId: bot };
}

/**
 * Express handler for Top.gg's vote webhook. Accepts Top.gg's current signed webhooks (x-topgg-signature,
 * secret starting whs_) and the older ones that send the secret as the Authorization header.
 * Top.gg retries anything that isn't a 2xx, so a vote that was recorded always gets a 200.
 * Needs the raw body on req.rawBody (see dashboard/server.js) to check signatures.
 *
 * @param {{
 *   secret: string,
 *   applicationId: string,
 *   logVote?: (userId: string, votes: number) => Promise<unknown>,
 *   record?: (userId: string) => Promise<number>,
 * }} options
 * @returns {import('express').RequestHandler}
 */
export function createTopggWebhook({ secret, applicationId, logVote, record = recordVote }) {
    return async (req, res) => {
        const signature = req.get('x-topgg-signature');
        const signed = Boolean(signature);
        const authorized = signed
            ? isValidSignature(signature, /** @type {any} */ (req).rawBody, secret)
            : isAuthorized(req.get('authorization'), secret);
        if (!authorized) {
            LogData(
                'Top.gg',
                `Refused a webhook request: ${signed ? 'bad signature' : 'wrong or missing Authorization'}`,
                'warning'
            );
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { test, ignore, userId, botId, voteId } = readVote(req.body, signed);
        if (ignore) return res.status(200).json({ ok: true });
        if (typeof userId !== 'string' || !SNOWFLAKE.test(userId))
            return res.status(400).json({ error: 'Invalid user' });
        if (botId !== undefined && botId !== applicationId) return res.status(400).json({ error: 'Wrong bot' });

        // The "Test" button on Top.gg: shows the webhook works, without counting as a vote
        if (test) {
            LogData('Top.gg', `Test vote received for ${userId}`, 'info');
            return res.status(200).json({ ok: true });
        }
        if (voteId && seenVotes.has(voteId)) return res.status(200).json({ ok: true });

        let votes;
        try {
            votes = await record(userId);
        } catch (error) {
            LogData('Top.gg', `Could not record a vote from ${userId}: ${error.message}`, 'error');
            return res.status(500).json({ error: 'Could not record the vote' }); // Top.gg will retry
        }
        if (voteId) {
            seenVotes.add(voteId);
            if (seenVotes.size > SEEN_MAX) seenVotes.delete(seenVotes.values().next().value);
        }

        LogData('Top.gg', `Vote from ${userId} (${votes} in total)`, 'info');
        logVote?.(userId, votes).catch(() => {}); // The developer log is a nice-to-have
        res.status(200).json({ ok: true });
    };
}
