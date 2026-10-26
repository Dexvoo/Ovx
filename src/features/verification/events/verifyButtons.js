import { Events, MessageFlags } from 'discord.js';
import { VERIFY_PREFIX, handleVerify } from '../utils/verify.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Verification: Buttons and Code';

/**
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
    if (!interaction.inCachedGuild() || !(interaction.isButton() || interaction.isModalSubmit())) return;
    if (!interaction.customId.startsWith(VERIFY_PREFIX)) return;
    try {
        await handleVerify(interaction);
    } catch (error) {
        LogData('Verification', `${interaction.customId} failed: ${error.message}`, 'error');
        const content = interaction.client.utils.Translate('verification.error', interaction.locale);
        if (interaction.replied || interaction.deferred)
            await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
        else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
}
