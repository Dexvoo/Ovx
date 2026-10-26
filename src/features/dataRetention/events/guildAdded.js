import { Events } from 'discord.js';
import { markGuildsPresent } from '../utils/retention.js';

export const name = Events.GuildCreate;
export const once = false;
export const description = 'Data Retention: Server Added';

/**
 * Ovx was added back within the 30 days, so the server keeps its data.
 * @param {import('discord.js').Guild} guild
 */
export async function execute(guild) {
    await markGuildsPresent([guild.id]);
}
