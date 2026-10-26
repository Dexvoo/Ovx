import { Events } from 'discord.js';
import { assignAutoRoles } from '../utils/assignAutoRoles.js';

export const name = Events.GuildMemberAdd;
export const once = false;
export const description = 'Auto Roles on Join';

/**
 * @param {import('discord.js').GuildMember} member
 */
export async function execute(member) {
    // With Rules Screening on, people get their roles once they accept the rules (see guildMemberUpdate.js)
    if (member.pending && !member.user.bot) return;
    await assignAutoRoles(member);
}
