import { deleteCase } from '../utils/cases.js';
import { hasPermissions, replySuccess, postPunishmentLog, t } from '../utils/common.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * Removes a warning given by mistake. Other cases (bans, kicks…) can only be removed on the dashboard.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    if (!(await hasPermissions(interaction, 'unwarn'))) return;
    const number = interaction.options.getInteger('case', true);

    const removed = await deleteCase(interaction.guildId, number, { onlyAction: 'warn' });
    if (!removed) return replyError(interaction, t(interaction, 'no_warning_case', { number }));

    await postPunishmentLog(interaction, 'Grey', 'unwarn', {
        user: `<@${removed.userId}>`,
        userId: removed.userId,
        reason: removed.reason ?? t(interaction, 'no_reason'),
        moderator: interaction.user.toString(),
        case: number,
    });
    return replySuccess(interaction, t(interaction, 'unwarned', { number, user: `<@${removed.userId}>` }));
}
