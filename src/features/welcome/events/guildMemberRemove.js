import { Events } from 'discord.js';
import { sendWelcome } from '../utils/sendWelcome.js';

export const name = Events.GuildMemberRemove;
export const once = false;
export const description = 'Goodbye Messages';

/**
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} member - Partial if the bot
 *   hadn't cached them; the user (all a goodbye needs) is always there
 */
export async function execute(member) {
    await sendWelcome('goodbye', member);
}
