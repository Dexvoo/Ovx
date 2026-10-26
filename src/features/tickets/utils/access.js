import { PermissionFlagsBits } from 'discord.js';
import { Ticket } from '../models/ticket.js';
import { findTicketType, staffRolesFor } from './ticketTypes.js';

/** What the bot needs in the ticket category to open tickets. */
export const CATEGORY_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles, // Setting who can see each ticket
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
];

/** What the bot needs in the transcript channel. */
export const TRANSCRIPT_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
];

/** What the owner, added members and staff can do in a ticket. */
export const MEMBER_ACCESS = Object.freeze({
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true,
});

/**
 * Staff can manage a ticket: anyone who can manage the server, has a general staff role,
 * or has a staff role for that ticket's type.
 * @param {import('discord.js').GuildMember} member
 * @param {import('../models/ticketConfig.js').TicketConfigType} config
 * @param {string | null} [typeId] - The ticket's type (left out: general staff only)
 */
export function isStaff(member, config, typeId = undefined) {
    const roleIds = typeId === undefined ? config.staffRoleIds : staffRolesFor(config, findTicketType(config, typeId));
    return (
        member.permissions.has(PermissionFlagsBits.ManageGuild) ||
        roleIds.some((roleId) => member.roles.cache.has(roleId))
    );
}

/**
 * The open ticket for a channel, or null if the channel isn't one.
 * @param {string} channelId
 * @returns {Promise<import('../models/ticket.js').TicketType & { _id: any } | null>}
 */
export async function findOpenTicket(channelId) {
    return /** @type {any} */ (await Ticket.findOne({ channelId, status: 'open' }).lean());
}
