import { Events } from 'discord.js';
import { recordGuildChange } from '../utils/usage.js';

export const name = Events.GuildDelete;
export const once = false;
export const description = 'Counts servers removing Ovx for the developer usage page';

/**
 * @param {import('discord.js').Guild} guild
 */
export async function execute(guild) {
    // An outage makes a server unavailable for a while; that isn't Ovx being removed
    if (guild.available) recordGuildChange('leaves');
}
