import { Events } from 'discord.js';
import { Ticket } from '../models/ticket.js';

export const name = Events.ChannelDelete;
export const once = false;
export const description = 'Tickets: Channel Deleted';

/**
 * A ticket channel deleted by hand (not by closing it) is marked closed, so it doesn't count as open forever.
 * @param {import('discord.js').Channel} channel
 */
export async function execute(channel) {
    await Ticket.updateOne(
        { channelId: channel.id, status: { $in: ['open', 'closing'] } },
        { $set: { status: 'closed', closedAt: new Date(), closeReason: 'Channel deleted' } }
    );
}
