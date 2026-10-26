import { MessageFlags, time, TimestampStyles } from 'discord.js';
import { auditReason, parseDuration, formatDuration } from '../utils/checks.js';
import { hasPermissions, replySuccess, t } from '../utils/common.js';
import { lockableChannel, lockChannel, postLockNotice, MIN_LOCK_MS, MAX_LOCK_MS } from '../utils/timers.js';
import { ChannelLock } from '../models/moderationTimers.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * Stops everyone talking in a channel (e.g. during a raid), for a while or until it's unlocked.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { options, guild, client } = interaction;
    const channel = options.getChannel('channel') ?? interaction.channel;
    if (!lockableChannel(channel)) return replyError(interaction, t(interaction, 'lock_channel_type'));
    if (!(await hasPermissions(interaction, 'lock', channel))) return;

    const durationText = options.getString('duration');
    const duration = durationText ? parseDuration(durationText) : null;
    if (durationText && duration === null) return replyError(interaction, t(interaction, 'bad_duration'));
    if (duration !== null && (duration < MIN_LOCK_MS || duration > MAX_LOCK_MS)) {
        return replyError(interaction, t(interaction, 'lock_duration_range'));
    }
    if (await ChannelLock.exists({ channelId: channel.id })) {
        return replyError(interaction, t(interaction, 'already_locked', { channel: channel.toString() }));
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const reason = options.getString('reason');
    const until = duration ? new Date(Date.now() + duration) : null;

    // Posted before the lock, since Ovx usually can't talk there afterwards either
    const translate = (key, args) => client.utils.Translate(`commands.moderation.${key}`, guild.preferredLocale, args);
    const noticeLines = [
        translate(until ? 'lock_notice_until' : 'lock_notice', {
            until: until && time(until, TimestampStyles.RelativeTime),
        }),
    ];
    if (reason) noticeLines.push(`${translate('reason_field')}: ${reason}`);
    const notice = await postLockNotice(channel, noticeLines.join('\n'));

    let result;
    try {
        result = await lockChannel(channel, {
            moderatorName: interaction.user.username,
            reason,
            until,
            auditReason: auditReason(interaction.user, reason),
        });
    } catch (error) {
        await notice?.delete().catch(() => {});
        return replyError(interaction, t(interaction, 'action_failed', { error: error.message }));
    }
    if (result === 'already_locked') {
        await notice?.delete().catch(() => {});
        return replyError(interaction, t(interaction, 'already_locked', { channel: channel.toString() }));
    }

    return replySuccess(
        interaction,
        until
            ? t(interaction, 'locked_until', {
                  channel: channel.toString(),
                  duration: formatDuration(duration),
                  until: time(until, TimestampStyles.ShortDateTime),
              })
            : t(interaction, 'locked', { channel: channel.toString() })
    );
}
