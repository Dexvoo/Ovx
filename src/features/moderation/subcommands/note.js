import { MessageFlags } from 'discord.js';
import { hasPermissions, recordCase, replySuccess, t } from '../utils/common.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * Adds a private note to someone's record, for other moderators: they aren't told, and it isn't a warning.
 * Works for people who have left too.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    if (!(await hasPermissions(interaction, 'note'))) return;
    const user = interaction.options.getUser('user', true);
    const text = interaction.options.getString('note', true).trim();
    if (!text) return replyError(interaction, t(interaction, 'note_empty'));

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const caseNumber = await recordCase(interaction, 'note', user, { reason: text });
    if (!caseNumber) return replyError(interaction, t(interaction, 'note_save_failed'));
    return replySuccess(interaction, t(interaction, 'note_added', { user: user.toString() }), { caseNumber });
}
