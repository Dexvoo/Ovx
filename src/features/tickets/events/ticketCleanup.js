import { Events } from 'discord.js';
import { Ticket } from '../models/ticket.js';
import { LogData } from '../../../shared/utils/logger.js';

export const name = Events.ClientReady;
export const once = true;
export const description = 'Tickets: Finish Interrupted Closes';

/** Closed tickets younger than this still have their channel deleted on startup. */
const RECENTLY_CLOSED_MS = 60 * 60 * 1000;

/**
 * Tidies up after a restart, for the servers on this shard:
 * - "closing" tickets were interrupted before their transcript was saved, so they're reopened;
 * - recently closed tickets whose channel still exists missed their delete timer, so the channel is deleted.
 * @param {import('discord.js').Client} client
 */
export async function execute(client) {
    const guildIds = [...client.guilds.cache.keys()];
    if (guildIds.length === 0) return;

    const tickets = await Ticket.find({
        guildId: { $in: guildIds },
        $or: [
            { status: 'closing' },
            { status: 'closed', closedAt: { $gte: new Date(Date.now() - RECENTLY_CLOSED_MS) } },
        ],
    }).lean();

    for (const ticket of tickets) {
        const channel = client.channels.cache.get(ticket.channelId);
        if (ticket.status === 'closing') {
            await Ticket.updateOne(
                { _id: ticket._id },
                channel ? { $set: { status: 'open' } } : { $set: { status: 'closed', closedAt: new Date() } }
            );
        } else if (channel && 'delete' in channel) {
            await channel.delete('Closed ticket (finishing after a restart)').catch((error) => {
                LogData('Tickets', `Could not delete ticket channel ${channel.id}: ${error.message}`, 'warning');
            });
        }
    }
}
