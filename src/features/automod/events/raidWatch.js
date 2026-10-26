import { Events } from 'discord.js';
import { onMemberJoin } from '../utils/raid.js';

export const name = Events.GuildMemberAdd;
export const once = false;
export const description = 'Anti-raid: Joins';

/**
 * @param {import('discord.js').GuildMember} member
 */
export async function execute(member) {
    await onMemberJoin(member);
}
