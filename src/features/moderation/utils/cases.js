import { ModCase, ModCaseCounter, CASE_ACTIONS } from '../models/modCase.js';
import { searchPattern } from '../../../dashboard/auditStore.js';

/**
 * @typedef {import('../models/modCase.js').CaseAction} CaseAction
 * @typedef {import('../models/modCase.js').ModCaseType} ModCaseType
 */

export const CASE_PAGE_SIZE = 50;
const SNOWFLAKE = /^\d{17,20}$/;

/** What the dashboard and commands see of a case (nothing internal like _id). */
export function caseView(doc) {
    return {
        number: doc.number,
        action: doc.action,
        userId: doc.userId,
        username: doc.username,
        moderatorId: doc.moderatorId ?? null,
        moderatorName: doc.moderatorName ?? null,
        reason: doc.reason ?? null,
        durationMs: doc.durationMs ?? null,
        source: doc.source ?? 'command',
        createdAt: doc.createdAt,
    };
}

/**
 * Records a case with the server's next case number.
 * @param {{ guildId: string, action: CaseAction, user: { id: string, username: string },
 *   moderator: { id: string, username: string } | null, reason?: string | null, durationMs?: number | null,
 *   source?: 'command' | 'discord' }} details
 */
export async function createCase({ guildId, action, user, moderator, reason = null, durationMs = null, source }) {
    const counter = await ModCaseCounter.findOneAndUpdate(
        { guildId },
        { $inc: { lastCase: 1 } },
        { upsert: true, returnDocument: 'after', lean: true }
    );
    const doc = await ModCase.create({
        guildId,
        number: /** @type {any} */ (counter).lastCase,
        action,
        userId: user.id,
        username: user.username,
        moderatorId: moderator?.id ?? null,
        moderatorName: moderator?.username ?? null,
        reason,
        durationMs,
        source: source ?? 'command',
    });
    return caseView(doc);
}

/**
 * A member's most recent cases and how many of each kind they have in total.
 * @param {string} guildId
 * @param {string} userId
 * @param {number} [limit]
 */
export async function memberHistory(guildId, userId, limit = 10) {
    const [docs, counts] = await Promise.all([
        ModCase.find({ guildId, userId }).sort({ number: -1 }).limit(limit).lean(),
        caseCounts(guildId, userId),
    ]);
    return { cases: docs.map(caseView), counts };
}

/**
 * How many cases of each kind a member has, e.g. { warn: 2, ban: 0, … }.
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<Record<CaseAction, number>>}
 */
export async function caseCounts(guildId, userId) {
    const totals = await ModCase.aggregate([
        { $match: { guildId, userId } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
    ]);
    const counts = /** @type {Record<CaseAction, number>} */ (
        Object.fromEntries(CASE_ACTIONS.map((action) => [action, 0]))
    );
    for (const { _id, count } of totals) counts[_id] = count;
    return counts;
}

/**
 * Removes one case. Only warnings when `onlyAction` is given (as /moderation unwarn does).
 * @param {string} guildId
 * @param {number} number
 * @param {{ onlyAction?: CaseAction }} [options]
 * @returns {Promise<ReturnType<typeof caseView> | null>} The removed case, or null if there was none
 */
export async function deleteCase(guildId, number, { onlyAction } = {}) {
    if (!Number.isSafeInteger(number) || number < 1) return null;
    const filter = { guildId, number, ...(onlyAction && { action: onlyAction }) };
    const doc = await ModCase.findOneAndDelete(filter).lean();
    return doc ? caseView(doc) : null;
}

/**
 * Case storage for the dashboard. Injectable, so the dashboard tests don't need a database.
 * @returns {{ list: (guildId: string, filters: { member?: string, action?: string, before?: string }) =>
 *   Promise<{ cases: any[], nextCursor: number | null }>, remove: (guildId: string, number: number) => Promise<any> }}
 */
export function createMongoCaseStore() {
    return {
        async list(guildId, { member, action, before } = {}) {
            const query = { guildId };

            // A pasted user ID matches exactly; anything else searches names
            const memberText = typeof member === 'string' ? member.trim() : '';
            if (SNOWFLAKE.test(memberText)) query.userId = memberText;
            else {
                const pattern = searchPattern(memberText);
                if (pattern) query.username = pattern;
            }

            if (typeof action === 'string' && CASE_ACTIONS.includes(/** @type {any} */ (action))) query.action = action;

            const cursor = Number(before);
            if (Number.isSafeInteger(cursor) && cursor > 0) query.number = { $lt: cursor };

            const docs = await ModCase.find(query)
                .sort({ number: -1 })
                .limit(CASE_PAGE_SIZE + 1)
                .lean();
            const page = docs.slice(0, CASE_PAGE_SIZE);
            return {
                cases: page.map(caseView),
                nextCursor: docs.length > CASE_PAGE_SIZE ? page[page.length - 1].number : null,
            };
        },

        remove: (guildId, number) => deleteCase(guildId, number),
    };
}
