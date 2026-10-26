import { MessageFlags } from 'discord.js';
import { auditReason } from '../utils/checks.js';
import { hasPermissions, replySuccess, t } from '../utils/common.js';
import { lockableChannel, unlockChannel, postLockNotice } from '../utils/timers.js';
import { ChannelLock } from '../models/moderationTimers.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * Ends a lock: everyone's permissions in the channel go back to how they were before it.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { options, guild, client } = interaction;
    const channel = options.getChannel('channel') ?? interaction.channel;
    if (!lockableChannel(channel)) return replyError(interaction, t(interaction, 'lock_channel_type'));
    if (!(await hasPermissions(interaction, 'unlock', channel))) return;

    const lock = await ChannelLock.findOne({ channelId: channel.id }).lean();
    if (!lock) return replyError(interaction, t(interaction, 'not_locked', { channel: channel.toString() }));

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        await unlockChannel(channel, lock, auditReason(interaction.user, options.getString('reason')));
    } catch (error) {
        return replyError(interaction, t(interaction, 'action_failed', { error: error.message }));
    }
    await postLockNotice(channel, client.utils.Translate('commands.moderation.unlock_notice', guild.preferredLocale));
    return replySuccess(interaction, t(interaction, 'unlocked', { channel: channel.toString() }));
}
