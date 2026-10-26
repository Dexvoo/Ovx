import { Events } from 'discord.js';
import { LIST_BUTTON_PREFIX, listPage } from '../utils/list.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Emoji and Sticker List Pages';

/**
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
    if (!interaction.isButton() || !interaction.inCachedGuild()) return;
    if (!interaction.customId.startsWith(`${LIST_BUTTON_PREFIX}:`)) return;

    const [kind, page] = interaction.customId.slice(LIST_BUTTON_PREFIX.length + 1).split(':');
    if (kind !== 'emoji' && kind !== 'sticker') return;

    try {
        await interaction.update(await listPage(interaction.guild, kind, Number(page), interaction.locale));
    } catch (error) {
        LogData('Expressions', `List page failed: ${error.message}`, 'warning');
    }
}
