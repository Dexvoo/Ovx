import { Events, AuditLogEvent } from 'discord.js';
import { getLogChannel, findAuditLogEntry, moderationDetails } from '../../utils/logChannel.js';

export const name = Events.GuildBanRemove;
export const once = false;
export const description = 'Guild Punishment Unban Logs';

/**
 * @param {import('discord.js').GuildBan} ban
 */

export async function execute(ban) {
    const { client, guild, user, reason: banReason } = ban;

    if (!guild) return;

    const logChannel = await getLogChannel(guild, 'punishment');
    if (!logChannel) return;

    const entry = await findAuditLogEntry(
        guild,
        AuditLogEvent.MemberBanRemove,
        (entry) => entry.targetId === user.id && Date.now() - entry.createdTimestamp < 5000,
        { targetId: user.id }
    );
    // The reason shown is the original ban's, as before
    const { moderator } = moderationDetails(entry, client.user.id);

    const title = client.utils.Translate('logs.punishment.unban_title', guild.preferredLocale);
    const description = client.utils.Translate('logs.punishment.unban_description', guild.preferredLocale, {
        user,
        reason: parseBanReason(banReason),
        moderator,
    });

    await client.utils.Embed(logChannel, 'Yellow', title, description, {
        timestamp: true,
        footer: { text: `UID: ${user.id}` },
        author: user,
    });
}

/** Bans made with /moderation have "By @name: " in front of the reason; the unban log shows just the reason. */
function parseBanReason(reason) {
    return reason?.replace(/^By @[a-z0-9_.]{2,32}: /, '') ?? reason;
}
