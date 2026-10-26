import { auditReason } from '../utils/checks.js';
import { hasPermissions, recordCase, replySuccess, t } from '../utils/common.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    if (!(await hasPermissions(interaction, 'unban'))) return;
    const { guild, options, member } = interaction;
    const user = options.getUser('user', true);
    const reason = options.getString('reason');

    if (!(await guild.bans.fetch(user.id).catch(() => null))) {
        return replyError(interaction, t(interaction, 'not_banned', { user: user.toString() }));
    }

    try {
        await guild.bans.remove(user.id, auditReason(member.user, reason));
    } catch (error) {
        return replyError(interaction, t(interaction, 'action_failed', { error: error.message }));
    }
    const caseNumber = await recordCase(interaction, 'unban', user, { reason });
    return replySuccess(interaction, t(interaction, 'unbanned', { user: user.toString() }), { caseNumber });
}
