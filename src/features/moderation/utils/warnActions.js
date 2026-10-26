import Moderation_Config_Cache from '../cache/moderationConfig.cache.js';
import { createCase } from './cases.js';
import { ACTION_PERMISSIONS, formatDuration } from './checks.js';
import { notifyMember } from './common.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('../models/moderationConfig.js').WarnActionType} WarnActionType
 * @typedef {{ rule: WarnActionType, caseNumber: number | null } | { rule: WarnActionType, failed: string, error?: string }} WarnActionResult
 */

/**
 * Runs the server's rule for this many warnings, if there is one. Ovx does it in its own name (the
 * moderator only gave a warning), so only Ovx's permissions and role matter.
 * A rule runs each time someone reaches its count exactly, so removing a warning and warning them again runs it again.
 *
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction - The warn command
 * @param {import('discord.js').GuildMember} target
 * @param {number} warnings - How many warnings they have now
 * @returns {Promise<WarnActionResult | null>} null when there's no rule for this count
 */
export async function runWarnAction(interaction, target, warnings) {
    const { guild, client } = interaction;
    const { warnActions } = await Moderation_Config_Cache.get(guild.id);
    const rule = warnActions.find((candidate) => candidate.warnings === warnings);
    if (!rule) return null;

    if (!guild.members.me.permissions.has(ACTION_PERMISSIONS[rule.action])) {
        return { rule, failed: 'auto_missing_perms' };
    }
    // Covers role order, the owner and administrators (who can't be timed out)
    const allowed = { ban: target.bannable, kick: target.kickable, mute: target.moderatable }[rule.action];
    if (!allowed) return { rule, failed: 'auto_not_allowed' };

    const memberReason = `Reached ${warnings} warnings`;
    const auditReason = `Automatic: reached ${warnings} warnings (warned by @${interaction.user.username})`;
    try {
        if (rule.action === 'mute') {
            await target.timeout(rule.durationMs, auditReason);
        } else {
            // Before they leave, while they still share a server with Ovx
            await notifyMember(interaction, target.user, rule.action, { reason: memberReason });
            if (rule.action === 'kick') await target.kick(auditReason);
            else await guild.bans.create(target.id, { reason: auditReason });
        }
    } catch (error) {
        return { rule, failed: 'auto_failed', error: error.message };
    }
    if (rule.action === 'mute') {
        await notifyMember(interaction, target.user, 'mute', {
            reason: memberReason,
            duration: formatDuration(rule.durationMs),
        });
    }

    let caseNumber = null;
    try {
        caseNumber = (
            await createCase({
                guildId: guild.id,
                action: rule.action,
                user: { id: target.id, username: target.user.username },
                moderator: { id: client.user.id, username: client.user.username },
                reason: memberReason,
                durationMs: rule.durationMs,
            })
        ).number;
    } catch (error) {
        LogData(
            'Moderation',
            `Could not save an automatic ${rule.action} case in ${guild.id}: ${error.message}`,
            'error'
        );
    }
    return { rule, caseNumber };
}
