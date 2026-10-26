import { Events } from 'discord.js';
import { getLogChannel } from '../../utils/logChannel.js';

export const name = Events.GuildMemberAdd;
export const once = false;
export const description = 'Guild Member Add Logs';

/**
 * @typedef {import('../../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').GuildMember & { client: Client }} member
 */

export async function execute(member) {
    const { guild, client } = member;

    if (!guild) return;

    const logChannel = await getLogChannel(guild, 'join');
    if (!logChannel) return;

    const position = `${guild.memberCount}${client.utils.GetOrdinalSuffix(guild.memberCount)}`;
    const longTimestamp = `${client.utils.Timestamp(member.user.createdAt, 'F')}`;
    const shortTimestamp = `${client.utils.Timestamp(member.user.createdAt, 'R')}`;

    const title = client.utils.Translate('logs.member.add_title', guild.preferredLocale);
    const description = client.utils.Translate('logs.member.add_description', guild.preferredLocale, {
        member,
        position,
        longTimestamp,
        shortTimestamp,
    });

    const footerText = `UID: ${member.id}`;

    await client.utils.Embed(logChannel, 'Green', title, description, {
        timestamp: true,
        footer: { text: footerText },
        author: member.user,
    });
}
