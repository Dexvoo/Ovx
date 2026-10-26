import { Events } from 'discord.js';
import { getLogChannel } from '../../utils/logChannel.js';

export const name = Events.GuildMemberRemove;
export const once = false;
export const description = 'Guild Member Remove Logs';

/**
 * @typedef {import('../../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').GuildMember & { client: Client }} member
 */

export async function execute(member) {
    const { guild, client } = member;

    if (!guild) return;

    const logChannel = await getLogChannel(guild, 'leave');
    if (!logChannel) return;

    // Members the bot hadn't cached arrive partial: no join date or roles, just the user
    const longTimestamp = member.joinedAt ? client.utils.Timestamp(member.joinedAt, 'F') : 'Unknown';
    const shortTimestamp = member.joinedAt ? client.utils.Timestamp(member.joinedAt, 'R') : 'unknown';
    const rolesList = member.roles?.cache
        ?.filter((role) => role.name !== '@everyone')
        .map((role) => role)
        .join(' • ');
    const roles = rolesList && rolesList.length > 0 ? rolesList.substring(0, 1024) : 'None';

    const title = client.utils.Translate('logs.member.remove_title', guild.preferredLocale);
    const description = client.utils.Translate('logs.member.remove_description', guild.preferredLocale, {
        member,
        longTimestamp,
        shortTimestamp,
        roles,
    });

    const footerText = `UID: ${member.id}`;

    await client.utils.Embed(logChannel, 'Red', title, description, {
        timestamp: true,
        footer: { text: footerText },
        author: member.user,
    });
}
