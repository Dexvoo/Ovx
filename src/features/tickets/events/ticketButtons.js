import { Events, MessageFlags } from 'discord.js';
import { TICKET_BUTTONS, LEGACY_BUTTONS } from '../utils/components.js';
import {
    createAction,
    askCloseAction,
    cancelCloseAction,
    closeAction,
    lockAction,
    claimAction,
} from '../utils/ticketActions.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Ticket Buttons';

const actions = {
    [TICKET_BUTTONS.create]: (interaction) => createAction(interaction), // Panels from before ticket types
    [TICKET_BUTTONS.close]: askCloseAction,
    [TICKET_BUTTONS.confirmClose]: (interaction) => closeAction(interaction),
    [TICKET_BUTTONS.cancelClose]: cancelCloseAction,
    [TICKET_BUTTONS.lock]: (interaction) => lockAction(interaction, true),
    [TICKET_BUTTONS.unlock]: (interaction) => lockAction(interaction, false),
    [TICKET_BUTTONS.claim]: claimAction,
};

/**
 * @param {import('discord.js').Interaction} interaction
 */
export async function execute(interaction) {
    if (!interaction.isButton() || !interaction.inCachedGuild()) return;

    const customId = LEGACY_BUTTONS[interaction.customId] ?? interaction.customId;

    // Ticket type buttons: ticket:create:<typeId>
    if (customId.startsWith(`${TICKET_BUTTONS.create}:`)) {
        return run(interaction, customId, () =>
            createAction(interaction, customId.slice(TICKET_BUTTONS.create.length + 1))
        );
    }
    if (!Object.hasOwn(actions, customId)) return;
    return run(interaction, customId, () => actions[customId](interaction));
}

/**
 * Runs a button action, telling the user (privately) if it fails.
 * @param {import('discord.js').ButtonInteraction<'cached'>} interaction
 * @param {string} customId
 * @param {() => Promise<unknown>} action
 */
async function run(interaction, customId, action) {
    try {
        await action();
    } catch (error) {
        LogData('Tickets', `Button ${customId} failed: ${error.stack ?? error.message}`, 'error');
        /** @type {import('discord.js').InteractionReplyOptions} */
        const reply = {
            content: interaction.client.utils.Translate('tickets.error', interaction.locale),
            flags: MessageFlags.Ephemeral,
        };
        if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {});
        else await interaction.reply(reply).catch(() => {});
    }
}
