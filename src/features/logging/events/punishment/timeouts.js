import { Events, AuditLogEvent } from 'discord.js';
import { getLogChannel, findAuditLogEntry, moderationDetails } from '../../utils/logChannel.js';

export const name = Events.GuildMemberUpdate;
export const once = false;
export const description = 'Guild Punishment Timeout Adds/Removed Logs';

/**
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} oldMember
 * @param {import('discord.js').GuildMember} newMember
 */

export async function execute(oldMember, newMember) {
    const { client, guild, user } = newMember;

    if (!guild) return;
    // A member the bot hadn't cached has no "before" to compare, so any update would look like a new timeout
    if (oldMember.partial) return;
    if (oldMember.communicationDisabledUntilTimestamp === newMember.communicationDisabledUntilTimestamp) return;

    const logChannel = await getLogChannel(guild, 'punishment');
    if (!logChannel) return;

    const entry = await findAuditLogEntry(
        guild,
        AuditLogEvent.MemberUpdate,
        (entry) => entry.targetId === user.id && Date.now() - entry.createdTimestamp < 5000,
        { targetId: user.id }
    );
    const { moderator } = moderationDetails(entry, client.user.id);
    const footer = { text: `UID: ${user.id}` };

    if (newMember.communicationDisabledUntilTimestamp === null) {
        const title = client.utils.Translate('logs.punishment.untimeout_title', guild.preferredLocale);
        const description = client.utils.Translate('logs.punishment.untimeout_description', guild.preferredLocale, {
            user,
            moderator,
        });
        return client.utils.Embed(logChannel, 'DarkerGrey', title, description, {
            timestamp: true,
            footer,
            author: user,
        });
    }

    const title = client.utils.Translate('logs.punishment.timeout_title', guild.preferredLocale);
    const description = client.utils.Translate('logs.punishment.timeout_description', guild.preferredLocale, {
        user,
        time: client.utils.Timestamp(newMember.communicationDisabledUntil),
        moderator,
    });

    return client.utils.Embed(logChannel, 'White', title, description, { timestamp: true, footer, author: user });
}
