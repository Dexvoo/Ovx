import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { TICKET_DEFAULTS } from './defaults.js';
import { ticketTypes } from './ticketTypes.js';

export { TICKET_DEFAULTS };

/** Custom IDs for the ticket buttons. Their prefixes are listed in shared/constants/componentIds.js. */
export const TICKET_BUTTONS = Object.freeze({
    create: 'ticket:create',
    close: 'ticket:close',
    confirmClose: 'ticket:close-confirm',
    cancelClose: 'ticket:close-cancel',
    lock: 'ticket:lock',
    unlock: 'ticket:unlock',
    claim: 'ticket:claim',
});

/**
 * Buttons from the old Ovx bot, still on panels and in open tickets in servers that used it.
 * They do the same as the new ones.
 */
export const LEGACY_BUTTONS = Object.freeze({
    'ovx-ticket-create': TICKET_BUTTONS.create,
    'ovx-ticket-close': TICKET_BUTTONS.close,
    'ovx-ticket-lock': TICKET_BUTTONS.lock,
    'ovx-ticket-unlock': TICKET_BUTTONS.unlock,
});

/** Button colours people can choose for ticket types. */
const BUTTON_STYLES = Object.freeze({
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
});

/**
 * The custom ID of a ticket type's button: ticket:create:<typeId>.
 * Plain "ticket:create" (panels posted before ticket types) opens the first type.
 * @param {string} typeId
 */
export function createButtonId(typeId) {
    return `${TICKET_BUTTONS.create}:${typeId}`;
}

/**
 * Ticket numbers are shown with at least four digits: #0001.
 * @param {number} number
 */
export function ticketLabel(number) {
    return String(number).padStart(4, '0');
}

/**
 * The panel people click to open a ticket: one button per ticket type (five to a row, as Discord allows),
 * with the types that have a description listed in the embed.
 * @param {import('../models/ticketConfig.js').TicketConfigType} config
 * @param {import('discord.js').ColorResolvable} colour
 * @returns {import('discord.js').MessageCreateOptions}
 */
export function panelMessage(config, colour) {
    const types = ticketTypes(config);
    const listed = types
        .filter((type) => type.description)
        .map((type) => `${type.emoji ? `${type.emoji} ` : ''}**${type.label}**: ${type.description}`);

    const embed = new EmbedBuilder()
        .setColor(colour)
        .setTitle(config.panel?.title ?? TICKET_DEFAULTS.panelTitle)
        .setDescription(
            [config.panel?.description ?? TICKET_DEFAULTS.panelDescription, listed.join('\n')]
                .filter(Boolean)
                .join('\n\n')
        );

    const rows = [];
    for (let index = 0; index < types.length; index += 5) {
        rows.push(
            /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
                types.slice(index, index + 5).map((type) => {
                    const button = new ButtonBuilder()
                        .setCustomId(createButtonId(type.id))
                        .setStyle(BUTTON_STYLES[type.style] ?? ButtonStyle.Primary)
                        .setLabel(type.label);
                    if (type.emoji) button.setEmoji(type.emoji);
                    return button;
                })
            )
        );
    }
    return { embeds: [embed], components: rows };
}

/**
 * The buttons inside a ticket. Lock and Unlock swap places, and Claim shows who has it.
 * @param {{ locked: boolean, claimedBy: string | null }} ticket
 * @param {string | null} [claimerName]
 */
export function ticketControls(ticket, claimerName = null) {
    return /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
        new ButtonBuilder()
            .setCustomId(TICKET_BUTTONS.close)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
            .setLabel('Close'),
        new ButtonBuilder()
            .setCustomId(TICKET_BUTTONS.claim)
            .setStyle(ticket.claimedBy ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji('🙋')
            .setLabel(ticket.claimedBy ? `Claimed by ${claimerName ?? 'staff'}`.slice(0, 80) : 'Claim'),
        ticket.locked
            ? new ButtonBuilder()
                  .setCustomId(TICKET_BUTTONS.unlock)
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('🔓')
                  .setLabel('Unlock')
            : new ButtonBuilder()
                  .setCustomId(TICKET_BUTTONS.lock)
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('🔐')
                  .setLabel('Lock')
    );
}

/**
 * Yes/no buttons shown before closing from the Close button.
 */
export function closeConfirmation() {
    return /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
        new ButtonBuilder()
            .setCustomId(TICKET_BUTTONS.confirmClose)
            .setStyle(ButtonStyle.Danger)
            .setLabel('Close ticket'),
        new ButtonBuilder().setCustomId(TICKET_BUTTONS.cancelClose).setStyle(ButtonStyle.Secondary).setLabel('Cancel')
    );
}
