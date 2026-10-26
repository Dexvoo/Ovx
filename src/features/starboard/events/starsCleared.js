import { Events } from 'discord.js';
import Starboard_Config_Cache from '../cache/starboardConfig.cache.js';
import { updateStarboard } from '../utils/starboard.js';

export const name = Events.MessageReactionRemoveAll;
export const once = false;
export const description = 'Starboard: Reactions Cleared';

/**
 * A moderator cleared every reaction: the count drops to 0.
 * @param {import('discord.js').Message | import('discord.js').PartialMessage} message
 */
export async function execute(message) {
    if (!message.guildId) return;
    const config = await Starboard_Config_Cache.get(message.guildId);
    if (config.enabled) await updateStarboard(message);
}
