import { Events, AuditLogEvent } from 'discord.js';
import { recordDiscordCase } from '../utils/discordCases.js';

export const name = Events.GuildBanAdd;
export const once = false;
export const description = 'Records bans made in Discord as moderation cases';

/**
 * @param {import('discord.js').GuildBan} ban
 */
export async function execute(ban) {
    await recordDiscordCase(ban.guild, { type: AuditLogEvent.MemberBanAdd, action: 'ban', user: ban.user });
}
