import { AuditLog } from './models/auditLog.js';

export const AUDIT_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;
const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * @typedef {Object} AuditEntryInput
 * @property {string} guildId
 * @property {{ id: string, username: string, displayName: string, avatar: string | null }} user
 * @property {string} action
 * @property {string[]} changes
 * @property {string} [source] - "Dashboard" (default) or the slash command used
 *
 * @typedef {Object} AuditFilters
 * @property {string} [username] - Matches username or display name, case-insensitive
 * @property {string} [action] - Matches the action, any change line or the source, case-insensitive
 * @property {string} [before] - Cursor from the previous page
 *
 * @typedef {{ record: (entry: AuditEntryInput) => Promise<void>, list: (guildId: string, filters: AuditFilters) =>
 *   Promise<{ entries: any[], nextCursor: string | null }> }} AuditStore
 */

/**
 * Web Logs storage in MongoDB.
 * @returns {AuditStore}
 */
export function createMongoAuditStore() {
    return {
        async record({ guildId, user, action, changes, source = 'Dashboard' }) {
            await AuditLog.create({
                guildId,
                userId: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                action,
                changes,
                source,
            });
        },

        async list(guildId, { username, action, before } = {}) {
            const query = { guildId };

            const userSearch = searchPattern(username);
            if (userSearch) query.$or = [{ username: userSearch }, { displayName: userSearch }];

            const actionSearch = searchPattern(action);
            if (actionSearch) {
                const actionMatch = {
                    $or: [{ action: actionSearch }, { changes: actionSearch }, { source: actionSearch }],
                };
                if (query.$or) {
                    query.$and = [{ $or: query.$or }, actionMatch];
                    delete query.$or;
                } else Object.assign(query, actionMatch);
            }

            // ObjectIds increase over time, so they double as a newest-first page cursor
            if (typeof before === 'string' && OBJECT_ID.test(before)) query._id = { $lt: before };

            const docs = await AuditLog.find(query)
                .sort({ _id: -1 })
                .limit(AUDIT_PAGE_SIZE + 1)
                .lean();

            const page = docs.slice(0, AUDIT_PAGE_SIZE);
            return {
                entries: page.map((doc) => ({
                    id: String(doc._id),
                    createdAt: doc.createdAt,
                    userId: doc.userId,
                    username: doc.username,
                    displayName: doc.displayName,
                    avatar: doc.avatar,
                    action: doc.action,
                    changes: doc.changes,
                    source: doc.source ?? 'Dashboard',
                })),
                nextCursor: docs.length > AUDIT_PAGE_SIZE ? String(page[page.length - 1]._id) : null,
            };
        },
    };
}

/**
 * Case-insensitive "contains" match for user-typed search text.
 * Every regex special character is escaped, so the text is matched literally: it can't add
 * patterns of its own (which could match unintended entries or be slow on purpose).
 * @param {unknown} text
 * @returns {RegExp | null}
 */
export function searchPattern(text) {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim().slice(0, MAX_SEARCH_LENGTH);
    if (!trimmed) return null;
    return new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}
