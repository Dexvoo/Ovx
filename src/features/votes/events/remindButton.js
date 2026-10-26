import { Events, MessageFlags } from 'discord.js';
import { REMIND_BUTTON_ID, toggleReminders } from '../utils/reminders.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Vote Reminder Button';

/**
 * The "Remind me" button, on /vote (which may be in a server, so the reply is only for whoever clicked)
 * and in reminder DMs.
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
    if (!interaction.isButton() || interaction.customId !== REMIND_BUTTON_ID) return;
    const t = (key) => interaction.client.utils.Translate(`commands.vote.${key}`, interaction.locale);
    try {
        const on = await toggleReminders(interaction.user.id);
        await interaction.reply({ content: t(on ? 'reminders_on' : 'reminders_off'), flags: MessageFlags.Ephemeral });
    } catch (error) {
        LogData('Vote Reminders', `Toggle failed: ${error.message}`, 'error');
        await interaction.reply({ content: t('reminders_error'), flags: MessageFlags.Ephemeral }).catch(() => {});
    }
}
