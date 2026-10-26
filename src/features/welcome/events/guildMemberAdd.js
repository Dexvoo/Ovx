import { Events } from 'discord.js';
import { sendWelcome } from '../utils/sendWelcome.js';

export const name = Events.GuildMemberAdd;
export const once = false;
export const description = 'Welcome Messages';

/**
 * @param {import('discord.js').GuildMember} member
 */
export async function execute(member) {
    await sendWelcome('welcome', member);
}
