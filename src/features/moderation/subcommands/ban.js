import { MessageFlags, time, TimestampStyles } from 'discord.js';
import { auditReason, parseDuration, formatDuration } from '../utils/checks.js';
import { hasPermissions, targetMember, notifyMember, recordCase, replySuccess, t } from '../utils/common.js';
import { MIN_BAN_MS, MAX_BAN_MS } from '../utils/timers.js';
import { TempBan } from '../models/moderationTimers.js';
import { replyError } from '../../../shared/utils/commandChecks.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * Bans a member, or anyone by ID (e.g. someone who already left). With a duration, Ovx unbans them when
 * it's up (see utils/timers.js).
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    if (!(await hasPermissions(interaction, 'ban'))) return;
    const { guild, options, member } = interaction;
    const user = options.getUser('user', true);
    const reason = options.getString('reason');

    const durationText = options.getString('duration');
    const duration = durationText ? parseDuration(durationText) : null;
    if (durationText && duration === null) return replyError(interaction, t(interaction, 'bad_duration'));
    if (duration !== null && (duration < MIN_BAN_MS || duration > MAX_BAN_MS)) {
        return replyError(interaction, t(interaction, 'ban_duration_range'));
    }

    // Someone still in the server goes through the role checks; someone who left can be banned by ID
    const inServer = Boolean(options.getMember('user') ?? (await guild.members.fetch(user.id).catch(() => null)));
    if (inServer && !(await targetMember(interaction, 'ban'))) return;
    if (await guild.bans.fetch(user.id).catch(() => null)) {
        return replyError(interaction, t(interaction, 'already_banned', { user: user.toString() }));
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const length = duration ? formatDuration(duration) : null;
    // Before the ban, while they still share a server with Ovx
    const notified =
        inServer && (await notifyMember(interaction, user, duration ? 'tempban' : 'ban', { reason, duration: length }));

    try {
        await guild.bans.create(user.id, {
            reason: auditReason(member.user, length ? `${reason ?? 'No reason given'} (for ${length})` : reason),
            deleteMessageSeconds: options.getInteger('delete-messages') ?? 0,
        });
    } catch (error) {
        return replyError(interaction, t(interaction, 'action_failed', { error: error.message }));
    }

    const caseNumber = await recordCase(interaction, 'ban', user, { reason, durationMs: duration });
    const shownReason = reason ?? t(interaction, 'no_reason');
    if (!duration) {
        // Banned for good: an older temporary ban mustn't lift it
        await TempBan.deleteOne({ guildId: guild.id, userId: user.id }).catch(() => {});
        return replySuccess(interaction, t(interaction, 'banned', { user: user.toString(), reason: shownReason }), {
            dmFailed: inServer && !notified,
            caseNumber,
        });
    }

    const expiresAt = new Date(Date.now() + duration);
    try {
        await TempBan.updateOne(
            { guildId: guild.id, userId: user.id },
            { $set: { username: user.username, expiresAt, caseNumber } },
            { upsert: true }
        );
    } catch (error) {
        LogData('Moderation', `Could not save a temporary ban in ${guild.id}: ${error.message}`, 'error');
        return replyError(interaction, t(interaction, 'tempban_save_failed', { user: user.toString() }));
    }
    return replySuccess(
        interaction,
        t(interaction, 'banned_temp', {
            user: user.toString(),
            duration: length,
            until: time(expiresAt, TimestampStyles.ShortDateTime),
            reason: shownReason,
        }),
        { dmFailed: inServer && !notified, caseNumber }
    );
}
