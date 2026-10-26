import { TICKET_DEFAULTS } from './defaults.js';

/** The type used before a server adds its own (and for tickets opened before ticket types existed). */
export const DEFAULT_TYPE_ID = 'default';

/**
 * The server's ticket types. A server that hasn't added any gets one, built from its older settings
 * (panel button label and ticket message), so nothing changes until it adds types.
 * @param {import('../models/ticketConfig.js').TicketConfigType} config
 * @returns {import('../models/ticketConfig.js').TicketTypeType[]}
 */
export function ticketTypes(config) {
    if (config.ticketTypes?.length) return config.ticketTypes;
    return [
        {
            id: DEFAULT_TYPE_ID,
            label: config.panel?.buttonLabel ?? TICKET_DEFAULTS.buttonLabel,
            emoji: '🎫',
            style: 'primary',
            description: null,
            channelPrefix: null,
            categoryId: null,
            staffRoleIds: [],
            allowedRoleIds: [],
            openMessage: config.openMessage ?? null,
        },
    ];
}

/**
 * A ticket type by ID. No ID (old panels and tickets) means the first type.
 * @param {import('../models/ticketConfig.js').TicketConfigType} config
 * @param {string | null | undefined} typeId
 * @returns {import('../models/ticketConfig.js').TicketTypeType | null} null if that type was removed
 */
export function findTicketType(config, typeId) {
    const types = ticketTypes(config);
    if (!typeId) return types[0];
    return types.find((type) => type.id === typeId) ?? null;
}

/**
 * Roles that can see and manage tickets of a type: the general staff roles plus the type's own.
 * @param {import('../models/ticketConfig.js').TicketConfigType} config
 * @param {import('../models/ticketConfig.js').TicketTypeType | null} type
 * @returns {string[]}
 */
export function staffRolesFor(config, type) {
    return [...new Set([...(config.staffRoleIds ?? []), ...(type?.staffRoleIds ?? [])])];
}
