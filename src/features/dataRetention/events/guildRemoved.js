import { Events } from 'discord.js';
import { markGuildLeft } from '../utils/retention.js';

export const name = Events.GuildDelete;
export const once = false;
export const description = 'Data Retention: Server Removed';

/**
 * Starts the 30 days before the server's data is deleted.
 * @param {import('discord.js').Guild} guild
 */
export async function execute(guild) {
    // An outage is not a removal (discord.js reports those as guildUnavailable, but be sure)
    if (!guild.available) return;
    await markGuildLeft(guild.id);
}
