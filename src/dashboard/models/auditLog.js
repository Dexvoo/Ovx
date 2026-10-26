import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/** How long dashboard audit entries are kept before MongoDB deletes them automatically. */
export const AUDIT_RETENTION_DAYS = 90;

/**
 * One settings change made through the dashboard or a slash command ("Web Logs").
 * Names (user, channels, roles) are stored as they were at the time, so the log stays readable
 * after something is renamed or deleted.
 *
 * @typedef {Object} AuditLogType
 * @property {string} guildId
 * @property {string} userId
 * @property {string} username - Discord username at the time
 * @property {string} displayName - Display name at the time
 * @property {string | null} avatar
 * @property {string} action - Short summary, e.g. "Updated level settings"
 * @property {string[]} changes - What changed, e.g. "Max level: 100 → 50"
 * @property {string} source - Where it was changed: "Dashboard" or the command, e.g. "/level settings max-level"
 * @property {Date} createdAt
 */

const AuditLogSchema = new Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    displayName: { type: String, required: true },
    avatar: { type: String, default: null },
    action: { type: String, required: true },
    changes: { type: [String], default: [] },
    source: { type: String, default: 'Dashboard' },
    createdAt: { type: Date, default: Date.now },
});

// Newest-first listing per server (ObjectIds increase over time, see auditStore.js)
AuditLogSchema.index({ guildId: 1, _id: -1 });
// MongoDB removes entries automatically once they're older than the retention period
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: AUDIT_RETENTION_DAYS * 24 * 60 * 60 });

export const AuditLog = model('Dashboard-Audit-Log', AuditLogSchema);
