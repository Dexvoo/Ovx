import { createCase } from './cases.js';
import { findAuditLogEntry } from '../../logging/utils/logChannel.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * Records a case for an action someone did in Discord itself (right-click > Ban, etc.), so a member's
 * history is complete. Who did it comes from the audit log; without permission to read it, or if Ovx did
 * it (/moderation already recorded that case), nothing is recorded.
 *
 * @param {import('discord.js').Guild} guild
 * @param {{ type: import('discord.js').AuditLogEvent, action: import('../models/modCase.js').CaseAction,
 *   user: import('discord.js').User, durationMs?: number | null,
 *   match?: (entry: import('discord.js').GuildAuditLogsEntry) => boolean }} details
 * @returns {Promise<boolean>} Whether a case was recorded
 */
export async function recordDiscordCase(guild, { type, action, user, durationMs = null, match = () => true }) {
    const entry = await findAuditLogEntry(
        guild,
        type,
        (entry) => entry.targetId === user.id && Date.now() - entry.createdTimestamp < 5000 && match(entry),
        { targetId: user.id }
    );
    const executor = entry?.executor;
    if (!executor || executor.id === guild.client.user.id) return false;

    try {
        await createCase({
            guildId: guild.id,
            action,
            user: { id: user.id, username: user.username },
            moderator: { id: executor.id, username: executor.username },
            reason: entry.reason ?? null,
            durationMs,
            source: 'discord',
        });
        return true;
    } catch (error) {
        LogData('Moderation', `Could not save a ${action} case in ${guild.id}: ${error.message}`, 'error');
        return false;
    }
}
