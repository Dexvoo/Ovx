import { Events, AuditLogEvent } from 'discord.js';
import { getLogChannel, findAuditLogEntry, moderationDetails } from '../../utils/logChannel.js';

export const name = Events.GuildBanAdd;
export const once = false;
export const description = 'Guild Punishment Ban Logs';

/**
 * @param {import('discord.js').GuildBan} ban
 */

export async function execute(ban) {
    const { client, guild, user } = ban;

    if (!guild) return;

    const logChannel = await getLogChannel(guild, 'punishment');
    if (!logChannel) return;

    // The ban event doesn't always include the reason, so fetch it
    const fetchedBan = await guild.bans.fetch(user.id).catch(() => null);
    const entry = await findAuditLogEntry(
        guild,
        AuditLogEvent.MemberBanAdd,
        (entry) => entry.targetId === user.id && Date.now() - entry.createdTimestamp < 5000,
        { targetId: user.id }
    );
    const { moderator, reason } = moderationDetails(entry, client.user.id, fetchedBan?.reason ?? ban.reason);

    const title = client.utils.Translate('logs.punishment.ban_title', guild.preferredLocale);
    const description = client.utils.Translate('logs.punishment.ban_description', guild.preferredLocale, {
        user,
        reason,
        moderator,
    });

    await client.utils.Embed(logChannel, 'Red', title, description, {
        timestamp: true,
        footer: { text: `UID: ${user.id}` },
    });
}
