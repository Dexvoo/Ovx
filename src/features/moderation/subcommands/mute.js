import { MessageFlags, time, TimestampStyles } from 'discord.js';
import { auditReason, parseDuration, formatDuration, MIN_MUTE_MS, MAX_MUTE_MS } from '../utils/checks.js';
import { hasPermissions, targetMember, notifyMember, recordCase, replySuccess, t } from '../utils/common.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * Times a member out. Muting someone who is already muted sets the new length.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    if (!(await hasPermissions(interaction, 'mute'))) return;
    const { options } = interaction;

    const duration = parseDuration(options.getString('duration', true));
    if (duration === null) return replyError(interaction, t(interaction, 'bad_duration'));
    if (duration < MIN_MUTE_MS || duration > MAX_MUTE_MS)
        return replyError(interaction, t(interaction, 'duration_range'));

    const target = await targetMember(interaction, 'mute');
    if (!target) return;
    const reason = options.getString('reason');
    const length = formatDuration(duration);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        await target.timeout(duration, auditReason(interaction.user, reason));
    } catch (error) {
        return replyError(interaction, t(interaction, 'action_failed', { error: error.message }));
    }
    // After the timeout, so nobody is told they're muted when it didn't work
    const notified = await notifyMember(interaction, target.user, 'mute', { reason, duration: length });
    const caseNumber = await recordCase(interaction, 'mute', target.user, { reason, durationMs: duration });

    return replySuccess(
        interaction,
        t(interaction, 'muted', {
            user: target.toString(),
            duration: length,
            until: time(new Date(Date.now() + duration), TimestampStyles.ShortDateTime),
            reason: reason ?? t(interaction, 'no_reason'),
        }),
        { dmFailed: !notified, caseNumber }
    );
}
