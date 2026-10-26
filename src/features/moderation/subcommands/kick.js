import { MessageFlags } from 'discord.js';
import { auditReason } from '../utils/checks.js';
import { hasPermissions, targetMember, notifyMember, recordCase, replySuccess, t } from '../utils/common.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    if (!(await hasPermissions(interaction, 'kick'))) return;
    const target = await targetMember(interaction, 'kick');
    if (!target) return;
    const reason = interaction.options.getString('reason');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // Before the kick, while they still share a server with Ovx
    const notified = await notifyMember(interaction, target.user, 'kick', { reason });

    try {
        await target.kick(auditReason(interaction.user, reason));
    } catch (error) {
        return replyError(interaction, t(interaction, 'action_failed', { error: error.message }));
    }

    const caseNumber = await recordCase(interaction, 'kick', target.user, { reason });
    return replySuccess(
        interaction,
        t(interaction, 'kicked', { user: target.toString(), reason: reason ?? t(interaction, 'no_reason') }),
        { dmFailed: !notified, caseNumber }
    );
}
