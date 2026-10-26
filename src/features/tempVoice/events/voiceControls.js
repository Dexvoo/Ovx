import { Events, MessageFlags } from 'discord.js';
import { TEMP_VOICE_PREFIX } from '../utils/panel.js';
import { handleControl } from '../utils/controls.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Temp Voice: Control Panel';

/**
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    if (!(interaction.isButton() || interaction.isModalSubmit() || interaction.isUserSelectMenu())) return;
    if (!interaction.customId.startsWith(TEMP_VOICE_PREFIX)) return;

    try {
        await handleControl(interaction);
    } catch (error) {
        LogData('Temp Voice', `${interaction.customId} failed: ${error.stack ?? error.message}`, 'error');
        const content = interaction.client.utils.Translate('tempVoice.controls.error', interaction.locale);
        if (interaction.replied || interaction.deferred)
            await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
        else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
}
