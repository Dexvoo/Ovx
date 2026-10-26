import { Events } from 'discord.js';
import { assignAutoRoles } from '../utils/assignAutoRoles.js';

export const name = Events.GuildMemberUpdate;
export const once = false;
export const description = 'Auto Roles after Rules Screening';

/**
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} oldMember
 * @param {import('discord.js').GuildMember} newMember
 */
export async function execute(oldMember, newMember) {
    // Only when someone has just accepted the server's rules
    if (!oldMember.pending || newMember.pending) return;
    await assignAutoRoles(newMember);
}
