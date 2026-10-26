import { Events, MessageFlags } from 'discord.js';
import { GIVEAWAY_BUTTONS } from '../utils/message.js';
import { enterGiveaway, leaveGiveaway } from '../utils/entry.js';
import { LEGACY_ENTER_PREFIX } from '../utils/legacy.js';
import { Giveaway } from '../models/giveaway.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Giveaway Buttons';

/**
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
    if (!interaction.isButton() || !interaction.inCachedGuild()) return;

    const { customId } = interaction;
    let action = null;
    if (customId.startsWith(`${GIVEAWAY_BUTTONS.enter}:`)) {
        action = () => enterGiveaway(interaction, customId.slice(GIVEAWAY_BUTTONS.enter.length + 1));
    } else if (customId.startsWith(`${GIVEAWAY_BUTTONS.leave}:`)) {
        action = () => leaveGiveaway(interaction, customId.slice(GIVEAWAY_BUTTONS.leave.length + 1));
    } else if (customId.startsWith(LEGACY_ENTER_PREFIX)) {
        // The old Ovx bot's button, on a message that hasn't been updated yet: found by its message
        action = async () => {
            const giveaway = await Giveaway.findOne(
                { guildId: interaction.guildId, messageId: interaction.message.id },
                { _id: 1 }
            ).lean();
            return enterGiveaway(interaction, giveaway ? String(giveaway._id) : '');
        };
    }
    if (!action) return;

    try {
        await action();
    } catch (error) {
        LogData('Giveaways', `Button ${customId} failed: ${error.stack ?? error.message}`, 'error');
        /** @type {import('discord.js').InteractionReplyOptions} */
        const reply = {
            content: interaction.client.utils.Translate('giveaways.entry.error', interaction.locale),
            flags: MessageFlags.Ephemeral,
        };
        if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {});
        else await interaction.reply(reply).catch(() => {});
    }
}
