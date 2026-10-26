import { MessageFlags } from 'discord.js';
import { auditReason, formatDuration } from '../utils/checks.js';
import { hasPermissions, replySuccess, t } from '../utils/common.js';
import { parseSlowmode, MAX_SLOWMODE_SECONDS } from '../utils/timers.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * Sets how long members wait between messages in a channel, or turns it off.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { options } = interaction;
    const channel = options.getChannel('channel') ?? interaction.channel;
    // Threads need Manage Threads, which Ovx doesn't ask for
    if (!channel || channel.isThread() || !('setRateLimitPerUser' in channel)) {
        return replyError(interaction, t(interaction, 'slowmode_channel_type'));
    }
    if (!(await hasPermissions(interaction, 'slowmode', channel))) return;

    const seconds = parseSlowmode(options.getString('duration', true));
    if (seconds === null) return replyError(interaction, t(interaction, 'bad_duration'));
    if (seconds > MAX_SLOWMODE_SECONDS) return replyError(interaction, t(interaction, 'slowmode_range'));

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        await channel.setRateLimitPerUser(seconds, auditReason(interaction.user, options.getString('reason')));
    } catch (error) {
        return replyError(interaction, t(interaction, 'action_failed', { error: error.message }));
    }
    return replySuccess(
        interaction,
        seconds === 0
            ? t(interaction, 'slowmode_off', { channel: channel.toString() })
            : t(interaction, 'slowmode_set', { channel: channel.toString(), duration: formatDuration(seconds * 1000) })
    );
}
