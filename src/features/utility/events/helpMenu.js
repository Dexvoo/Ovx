import { Events, PermissionFlagsBits } from 'discord.js';
import { HELP_MENU_ID, overviewPage, categoryPage } from '../utils/help.js';
import { helpContext } from '../commands/help.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Help Menu';

/**
 * The category menu on /help. The page is rebuilt from the choice, so it keeps working after a restart.
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== HELP_MENU_ID) return;

    try {
        const help = await helpContext(interaction);
        const [choice] = interaction.values;
        const canManage = Boolean(
            interaction.inCachedGuild() && interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
        );
        const page =
            choice === 'overview'
                ? await overviewPage(interaction.client, help, { canManage })
                : await categoryPage(interaction.client, help, choice);
        if (page) await interaction.update(page);
    } catch (error) {
        LogData('Help', `Menu failed: ${error.stack ?? error.message}`, 'error');
    }
}
