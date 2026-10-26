import { MessageFlags } from 'discord.js';
import { caseCounts } from '../utils/cases.js';
import { runWarnAction } from '../utils/warnActions.js';
import { formatDuration } from '../utils/checks.js';
import {
    hasPermissions,
    targetMember,
    notifyMember,
    recordCase,
    replySuccess,
    postPunishmentLog,
    t,
} from '../utils/common.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * Gives a member a warning: it's added to their record, and they're told why.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    if (!(await hasPermissions(interaction, 'warn'))) return;
    const target = await targetMember(interaction, 'warn');
    if (!target) return;
    if (target.user.bot) return replyError(interaction, t(interaction, 'warn_bot'));
    const reason = interaction.options.getString('reason', true);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const caseNumber = await recordCase(interaction, 'warn', target.user, { reason });
    if (!caseNumber) return replyError(interaction, t(interaction, 'case_save_failed'));

    const notified = await notifyMember(interaction, target.user, 'warn', { reason });
    const counts = await caseCounts(interaction.guildId, target.id);

    await postPunishmentLog(interaction, 'Gold', 'warn', {
        user: target.toString(),
        userId: target.id,
        reason,
        moderator: interaction.user.toString(),
        case: caseNumber,
        count: counts.warn,
    });

    const lines = [t(interaction, 'warned', { user: target.toString(), reason, count: counts.warn })];
    const automatic = await runWarnAction(interaction, target, counts.warn);
    if (automatic) lines.push('', automaticLine(interaction, automatic, counts.warn));

    return replySuccess(interaction, lines.join('\n'), { dmFailed: !notified, caseNumber });
}

/**
 * What the server's rule for this many warnings did, e.g. "They reached 3 warnings, so they were muted for 1 hour."
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 * @param {import('../utils/warnActions.js').WarnActionResult} result
 * @param {number} warnings
 */
function automaticLine(interaction, result, warnings) {
    const { rule } = result;
    const args = {
        warnings,
        action: t(interaction, `auto_${rule.action}`, {
            duration: rule.durationMs ? formatDuration(rule.durationMs) : '',
        }),
    };
    if ('failed' in result) return t(interaction, result.failed, { ...args, error: result.error ?? '' });
    const caseNote = result.caseNumber ? ` (${t(interaction, 'case_line', { number: result.caseNumber })})` : '';
    return t(interaction, 'auto_done', args) + caseNote;
}
