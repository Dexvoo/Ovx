import { Events, AuditLogEvent } from 'discord.js';
import { recordDiscordCase } from '../utils/discordCases.js';
import { TempBan } from '../models/moderationTimers.js';

export const name = Events.GuildBanRemove;
export const once = false;
export const description = 'Records unbans made in Discord as moderation cases';

/**
 * @param {import('discord.js').GuildBan} ban
 */
export async function execute(ban) {
    // Unbanned early (by anyone): a temporary ban has nothing left to end
    await TempBan.deleteOne({ guildId: ban.guild.id, userId: ban.user.id }).catch(() => {});
    await recordDiscordCase(ban.guild, { type: AuditLogEvent.MemberBanRemove, action: 'unban', user: ban.user });
}
