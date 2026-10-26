import { Events } from 'discord.js';
import { commandKey, recordCommand } from '../utils/usage.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Counts command use for the developer usage page';

/**
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
    if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;
    recordCommand(commandKey(interaction), interaction.guildId);
}
