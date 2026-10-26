import { Events } from 'discord.js';
import Starboard_Config_Cache from '../cache/starboardConfig.cache.js';
import { isStarEmoji, updateStarboard } from '../utils/starboard.js';

export const name = Events.MessageReactionRemove;
export const once = false;
export const description = 'Starboard: Stars Removed';

/**
 * @param {import('discord.js').MessageReaction | import('discord.js').PartialMessageReaction} reaction
 */
export async function execute(reaction) {
    const guildId = reaction.message.guildId;
    if (!guildId) return;
    const config = await Starboard_Config_Cache.get(guildId);
    if (!config.enabled || !isStarEmoji(reaction.emoji, config.emoji)) return;
    await updateStarboard(reaction.message);
}
