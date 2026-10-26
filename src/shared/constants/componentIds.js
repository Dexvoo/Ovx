/**
 * Buttons and menus handled by a feature's own event, by custom ID prefix.
 * The catch-all in utility/events/slashCommands.js leaves these alone, so two handlers never answer the same click.
 */
export const HANDLED_COMPONENT_PREFIXES = Object.freeze([
    'ticket:', // features/tickets/events/ticketButtons.js
    'giveaway:', // features/giveaways/events/giveawayButtons.js
    'giveaway-enter.', // Enter buttons from the old Ovx bot, also answered by giveawayButtons.js
    'expressions:', // features/expressions/events/listButtons.js
    'rr:', // features/reactionRoles/events/roleButtons.js
    'select-role.', // Reaction role dropdowns from the old Ovx bot, also answered by roleButtons.js
    'vote:', // features/votes/events/remindButton.js
    'help:', // features/utility/events/helpMenu.js
    'sg:', // features/suggestions/events/voteButtons.js
    'vf:', // features/verification/events/verifyButtons.js (buttons and the code form)
    'tv:', // features/tempVoice/events/voiceControls.js (buttons, forms and member pickers)
    'ovx-ticket-', // Ticket buttons from the old Ovx bot, still on panels in servers that used it
]);

/**
 * @param {string} customId
 */
export function isHandledComponent(customId) {
    return HANDLED_COMPONENT_PREFIXES.some((prefix) => customId.startsWith(prefix));
}
