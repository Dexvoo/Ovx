import { Events } from 'discord.js';
import { recordGuildChange } from '../utils/usage.js';

export const name = Events.GuildCreate;
export const once = false;
export const description = 'Counts servers adding Ovx for the developer usage page';

/**
 * @param {import('discord.js').Guild} guild
 */
export async function execute(guild) {
    if (guild.available) recordGuildChange('joins');
}
