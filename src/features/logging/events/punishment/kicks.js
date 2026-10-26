import { Events, AuditLogEvent } from 'discord.js';
import { getLogChannel, findAuditLogEntry, moderationDetails } from '../../utils/logChannel.js';

export const name = Events.GuildMemberRemove;
export const once = false;
export const description = 'Guild Punishment Kick Logs';

/**
 * Discord has no kick event: a kick is a member leaving with a matching kick in the audit log.
 * Without permission to view the audit log, kicks can't be told apart from leaves, so nothing is posted.
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} member
 */
export async function execute(member) {
    const { client, guild, user } = member;
    if (!guild) return;

    const logChannel = await getLogChannel(guild, 'punishment');
    if (!logChannel) return;

    const entry = await findAuditLogEntry(
        guild,
        AuditLogEvent.MemberKick,
        (entry) => entry.targetId === user.id && Date.now() - entry.createdTimestamp < 5000,
        { targetId: user.id }
    );
    if (!entry) return; // They left on their own (or it can't be told)

    const { moderator, reason } = moderationDetails(entry, client.user.id);
    const title = client.utils.Translate('logs.punishment.kick_title', guild.preferredLocale);
    const description = client.utils.Translate('logs.punishment.kick_description', guild.preferredLocale, {
        user,
        reason: reason ?? 'No reason given',
        moderator,
    });

    await client.utils.Embed(logChannel, 'Orange', title, description, {
        timestamp: true,
        footer: { text: `UID: ${user.id}` },
        author: user,
    });
}
