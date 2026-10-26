import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { Ticket } from '../models/ticket.js';
import { TRANSCRIPT_PERMISSIONS } from './access.js';
import { ticketLabel } from './components.js';
import { findTicketType } from './ticketTypes.js';
import { buildTranscriptHtml, fetchTranscriptMessages, TRANSCRIPT_MESSAGE_LIMIT } from './transcript.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { LogData } from '../../../shared/utils/logger.js';

/** How long the "closing" message is shown before the channel is deleted. */
export const DELETE_DELAY_MS = 5_000;

/**
 * @typedef {{ ok: true, transcriptUrl: string | null } |
 *   { ok: false, reason: 'already_closing' | 'transcript_failed', detail?: string }} CloseResult
 */

/**
 * Closes a ticket: saves a transcript, sends it to the transcript channel (and the owner, if switched on),
 * then deletes the channel.
 *
 * Only one close can run at a time (the ticket is claimed as "closing" first). If the transcript can't be
 * posted to the transcript channel, the ticket is reopened rather than deleting the conversation for good.
 *
 * @param {{ channel: import('discord.js').TextChannel, ticket: import('./manageTicket.js').StoredTicket,
 *   config: import('../models/ticketConfig.js').TicketConfigType, closedBy: import('discord.js').GuildMember,
 *   reason: string | null }} options
 * @returns {Promise<CloseResult>}
 */
export async function closeTicket({ channel, ticket, config, closedBy, reason }) {
    const claimed = await Ticket.findOneAndUpdate(
        { _id: ticket._id, status: 'open' },
        { $set: { status: 'closing' } },
        { returnDocument: 'after', lean: true }
    );
    if (!claimed) return { ok: false, reason: 'already_closing' };

    const { guild } = channel;
    const label = ticketLabel(ticket.number);
    const closedAt = new Date();

    let transcriptUrl = null;
    let file;
    let summary;
    try {
        const messages = await fetchTranscriptMessages(channel);
        const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
        const ownerName = owner ? `${owner.displayName} (@${owner.user.username})` : `Unknown user (${ticket.ownerId})`;

        const html = buildTranscriptHtml({
            guildName: guild.name,
            ticketNumber: label,
            channelName: channel.name,
            ownerName,
            closedByName: `${closedBy.displayName} (@${closedBy.user.username})`,
            reason,
            openedAt: ticket.createdAt,
            closedAt,
            messages,
            truncated: messages.length >= TRANSCRIPT_MESSAGE_LIMIT,
        });
        file = () => new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `ticket-${label}.html` });

        summary = new EmbedBuilder()
            .setColor(await brandColour(guild.id))
            .setTitle(`${findTicketType(config, ticket.typeId)?.label ?? 'Ticket'} #${label} closed`)
            .addFields(
                { name: 'Opened by', value: `<@${ticket.ownerId}>`, inline: true },
                { name: 'Closed by', value: `<@${closedBy.id}>`, inline: true },
                { name: 'Claimed by', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Nobody', inline: true },
                { name: 'Reason', value: reason ?? 'None given' },
                { name: 'Messages', value: String(messages.length), inline: true },
                {
                    name: 'Opened',
                    value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:f>`,
                    inline: true,
                }
            )
            .setTimestamp(closedAt);

        const transcriptChannel = config.transcriptChannelId
            ? guild.channels.cache.get(config.transcriptChannelId)
            : null;
        if (config.transcriptChannelId) {
            if (!transcriptChannel?.isTextBased()) throw new Error('The transcript channel no longer exists');
            const missing = guild.members.me?.permissionsIn(transcriptChannel).missing(TRANSCRIPT_PERMISSIONS) ?? [];
            if (missing.length > 0)
                throw new Error(`Missing permissions in the transcript channel: ${missing.join(', ')}`);

            const posted = await transcriptChannel.send({
                embeds: [summary],
                files: [file()],
                allowedMentions: { parse: [] },
            });
            transcriptUrl = posted.attachments.first()?.url ?? posted.url;
        }
    } catch (error) {
        await Ticket.updateOne({ _id: ticket._id }, { $set: { status: 'open' } });
        LogData(
            'Tickets',
            `Guild: ${guild.name} | Could not save the transcript for #${label}: ${error.message}`,
            'error'
        );
        return { ok: false, reason: 'transcript_failed', detail: error.message };
    }

    if (config.dmTranscript) {
        const owner = await guild.client.users.fetch(ticket.ownerId).catch(() => null);
        await owner
            ?.send({
                content: `Your ticket in **${guild.name}** was closed. Here is a copy.`,
                embeds: [summary],
                files: [file()],
            })
            .catch(() => {}); // DMs closed: the transcript is still in the transcript channel
    }

    await Ticket.updateOne(
        { _id: ticket._id },
        { $set: { status: 'closed', closedAt, closedBy: closedBy.id, closeReason: reason, transcriptUrl } }
    );

    scheduleDelete(channel, `Ticket #${label} closed by ${closedBy.user.username}`);
    return { ok: true, transcriptUrl };
}

/**
 * Deletes a closed ticket's channel after a short delay. If the bot restarts first, ticketCleanup.js
 * deletes it on startup instead.
 * @param {import('discord.js').GuildChannel} channel
 * @param {string} reason
 */
export function scheduleDelete(channel, reason) {
    setTimeout(() => {
        channel.delete(reason).catch((error) => {
            LogData('Tickets', `Could not delete ticket channel ${channel.id}: ${error.message}`, 'warning');
        });
    }, DELETE_DELAY_MS).unref();
}
