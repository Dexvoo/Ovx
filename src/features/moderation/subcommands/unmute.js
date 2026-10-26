import { auditReason } from '../utils/checks.js';
import { hasPermissions, targetMember, recordCase, replySuccess, t } from '../utils/common.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    if (!(await hasPermissions(interaction, 'unmute'))) return;
    const target = await targetMember(interaction, 'unmute');
    if (!target) return;

    if ((target.communicationDisabledUntilTimestamp ?? 0) <= Date.now()) {
        return replyError(interaction, t(interaction, 'not_muted', { user: target.toString() }));
    }

    const reason = interaction.options.getString('reason');
    try {
        await target.timeout(null, auditReason(interaction.user, reason));
    } catch (error) {
        return replyError(interaction, t(interaction, 'action_failed', { error: error.message }));
    }
    const caseNumber = await recordCase(interaction, 'unmute', target.user, { reason });
    return replySuccess(interaction, t(interaction, 'unmuted', { user: target.toString() }), { caseNumber });
}
