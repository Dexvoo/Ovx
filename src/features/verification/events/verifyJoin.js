import { Events } from 'discord.js';
import { onJoin } from '../utils/verify.js';

export const name = Events.GuildMemberAdd;
export const once = false;
export const description = 'Verification: Unverified Role';

/**
 * @param {import('discord.js').GuildMember} member
 */
export async function execute(member) {
    await onJoin(member);
}
