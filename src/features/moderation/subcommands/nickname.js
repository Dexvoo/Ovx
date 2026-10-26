import { auditReason } from '../utils/checks.js';
import { hasPermissions, targetMember, replySuccess, t } from '../utils/common.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * Sets a member's nickname, or resets it when no nickname is given.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    if (!(await hasPermissions(interaction, 'nickname'))) return;
    const target = await targetMember(interaction, 'nickname');
    if (!target) return;

    const nickname = interaction.options.getString('nickname')?.trim() || null;
    try {
        await target.setNickname(nickname, auditReason(interaction.user, null));
    } catch (error) {
        return replyError(interaction, t(interaction, 'action_failed', { error: error.message }));
    }

    return replySuccess(
        interaction,
        nickname
            ? t(interaction, 'nickname_set', { user: target.toString(), nickname })
            : t(interaction, 'nickname_reset', { user: target.toString() })
    );
}
