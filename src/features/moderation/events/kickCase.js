import { Events, AuditLogEvent } from 'discord.js';
import { recordDiscordCase } from '../utils/discordCases.js';

export const name = Events.GuildMemberRemove;
export const once = false;
export const description = 'Records kicks made in Discord as moderation cases';

/**
 * A member leaving is only a kick if the audit log has a matching kick.
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} member
 */
export async function execute(member) {
    await recordDiscordCase(member.guild, { type: AuditLogEvent.MemberKick, action: 'kick', user: member.user });
}
