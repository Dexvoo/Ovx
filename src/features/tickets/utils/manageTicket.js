import { OverwriteType } from 'discord.js';
import { Ticket } from '../models/ticket.js';
import { MEMBER_ACCESS } from './access.js';
import { ticketControls } from './components.js';

/**
 * Changes to an open ticket. Each takes the ticket as stored and returns the updated one.
 * @typedef {import('../models/ticket.js').TicketType & { _id: any }} StoredTicket
 */

/**
 * Locks or unlocks a ticket. Locked: the owner and added members can still read it, but not send messages.
 * @param {import('discord.js').TextChannel} channel
 * @param {StoredTicket} ticket
 * @param {boolean} locked
 * @param {string} reason - For Discord's audit log
 */
export async function setLocked(channel, ticket, locked, reason) {
    for (const userId of [ticket.ownerId, ...ticket.addedUserIds]) {
        await channel.permissionOverwrites.edit(
            userId,
            { SendMessages: !locked },
            { reason, type: OverwriteType.Member }
        );
    }
    return updateTicket(channel, ticket, { locked });
}

/**
 * Claims a ticket for a staff member, or unclaims it (claimedBy null).
 * @param {import('discord.js').TextChannel} channel
 * @param {StoredTicket} ticket
 * @param {string | null} claimedBy
 */
export function setClaimedBy(channel, ticket, claimedBy) {
    return updateTicket(channel, ticket, { claimedBy });
}

/**
 * Lets someone else see and talk in the ticket (respecting the lock).
 * @param {import('discord.js').TextChannel} channel
 * @param {StoredTicket} ticket
 * @param {string} userId
 * @param {string} reason
 */
export async function addMember(channel, ticket, userId, reason) {
    await channel.permissionOverwrites.edit(
        userId,
        { ...MEMBER_ACCESS, SendMessages: !ticket.locked },
        { reason, type: OverwriteType.Member }
    );
    return updateTicket(channel, ticket, { addedUserIds: [...new Set([...ticket.addedUserIds, userId])] });
}

/**
 * Removes someone who was added. The owner can't be removed from their own ticket.
 * @param {import('discord.js').TextChannel} channel
 * @param {StoredTicket} ticket
 * @param {string} userId
 * @param {string} reason
 */
export async function removeMember(channel, ticket, userId, reason) {
    await channel.permissionOverwrites.delete(userId, reason);
    return updateTicket(channel, ticket, { addedUserIds: ticket.addedUserIds.filter((id) => id !== userId) });
}

/**
 * Saves changes to the ticket and refreshes its buttons (e.g. Lock ↔ Unlock).
 * @param {import('discord.js').TextChannel} channel
 * @param {StoredTicket} ticket
 * @param {Partial<import('../models/ticket.js').TicketType>} changes
 * @returns {Promise<StoredTicket>}
 */
async function updateTicket(channel, ticket, changes) {
    const updated = /** @type {StoredTicket} */ (
        await Ticket.findOneAndUpdate({ _id: ticket._id }, { $set: changes }, { returnDocument: 'after', lean: true })
    );
    await refreshControls(channel, updated);
    return updated;
}

/**
 * Updates the buttons on the ticket's first message. If that message was deleted, nothing happens.
 * @param {import('discord.js').TextChannel} channel
 * @param {StoredTicket} ticket
 */
export async function refreshControls(channel, ticket) {
    if (!ticket.controlMessageId) return;
    const message = await channel.messages.fetch(ticket.controlMessageId).catch(() => null);
    if (!message) return;

    const claimer = ticket.claimedBy ? await channel.guild.members.fetch(ticket.claimedBy).catch(() => null) : null;
    await message.edit({ components: [ticketControls(ticket, claimer?.displayName ?? null)] }).catch(() => {});
}
