import { MessageFlags } from 'discord.js';
import { hasPermissions, postPunishmentLog, replySuccess, t } from '../utils/common.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/** Discord only bulk-deletes messages younger than 14 days. */
const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60_000;

/**
 * Picks which of the fetched messages (newest first) to delete: not pinned, from the chosen user if any,
 * young enough to bulk-delete, at most `amount`.
 * @param {import('discord.js').Message[]} messages
 * @param {{ amount: number, userId?: string | null, now?: number }} options
 */
export function messagesToPurge(messages, { amount, userId = null, now = Date.now() }) {
    return messages
        .filter((message) => !message.pinned)
        .filter((message) => !userId || message.author.id === userId)
        .filter((message) => now - message.createdTimestamp < BULK_DELETE_MAX_AGE_MS)
        .slice(0, amount);
}

/**
 * Deletes recent messages in this channel, optionally only one person's. Pinned messages are kept.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { channel, options } = interaction;
    if (!channel || !('bulkDelete' in channel)) return replyError(interaction, t(interaction, 'purge_channel'));
    if (!(await hasPermissions(interaction, 'purge'))) return;

    const amount = options.getInteger('amount', true);
    const user = options.getUser('user');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const fetched = await channel.messages.fetch({ limit: 100 });
    const chosen = messagesToPurge([...fetched.values()], { amount, userId: user?.id });
    if (chosen.length === 0) return replyError(interaction, t(interaction, 'purge_none'));

    let deleted;
    try {
        deleted = await channel.bulkDelete(chosen, true);
    } catch (error) {
        return replyError(interaction, t(interaction, 'action_failed', { error: error.message }));
    }

    await postPunishmentLog(interaction, 'DarkOrange', 'purge', {
        count: deleted.size,
        channel: channel.toString(),
        from: user ? user.toString() : t(interaction, 'purge_everyone'),
        moderator: interaction.user.toString(),
    });

    const lines = [
        user
            ? t(interaction, 'purged_user', { count: deleted.size, user: user.toString() })
            : t(interaction, 'purged', { count: deleted.size }),
    ];
    if (deleted.size < amount) lines.push(`-# ${t(interaction, 'purge_fewer')}`);
    return replySuccess(interaction, lines.join('\n'));
}
