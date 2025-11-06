const { Colors, EmbedBuilder, GuildMember, MessageFlags } = require('discord.js');
const { TicketInstance, TicketConfig } = require('../../models/GuildSetups');
const { createTranscript } = require('discord-html-transcripts');

const CLOSE_DELAY = 10_000;

/**
 * @param {import('../../types').ButtonUtils | import('../../types').CommandInputUtils} interaction
 * @param {{ TicketData: TicketInstance, TicketConfigData: TicketConfig, isAdmin: boolean, isMod: boolean, ticketOwner: GuildMember | null }} context
 */
module.exports = async function TicketClose(interaction, context) {
    const { client, guild, channel, member } = interaction;
    const { TicketData, TicketConfigData, isAdmin, isMod, ticketOwner } = context;
    const isOwner = TicketData?.memberId === member.id;

    if (!TicketConfigData?.enabled) return client.utils.Embed(interaction, Colors.Red, 'Tickets | Not Enabled', 'Tickets are not enabled on this server.');
    if (!TicketData?.open) return; // Silently exit if already closing/closed.
    if (!isAdmin && !isMod && !isOwner) return client.utils.Embed(interaction, Colors.Red, 'Tickets | Permission Denied', 'You do not have permission to close this ticket.');

    // Acknowledge the interaction immediately
    await client.utils.Embed(interaction, Colors.Blurple, 'Tickets | Closing Ticket', `This ticket is being closed and archived...`, { ephemeral: false });

    // Mark as closing to prevent double-actions
    TicketData.open = false; 
    await TicketData.save();

    let transcript;
    try {
        transcript = await createTranscript(channel, {
            favicon: client.user.displayAvatarURL(),
            saveImages: true,
            limit: -1, // -1 for unlimited
            filename: `${guild.name}-Ticket-${TicketData.ticketId}.html`,
            poweredBy: false,
        });
    } catch (error) {
        console.error('Transcript creation failed:', error);
        return channel.send({ content: 'Failed to create a transcript. Please contact an admin.' });
    }

    const transcriptEmbed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setDescription(`**Guild:** ${guild.name}\n**Ticket ID:** ${TicketData.ticketId}\n**Opened by:** ${ticketOwner || 'Unknown User'}\n**Closed by:** ${member}`)
        .setColor(Colors.Blurple);

    const archiveChannel = await guild.channels.fetch(TicketConfigData.archiveChannelId).catch(() => null);

    let transcriptURL = '';
    if (archiveChannel) {
        try {
            const message = await archiveChannel.send({ embeds: [transcriptEmbed], files: [transcript] });
            transcriptURL = message.attachments.first()?.url || '';
        } catch (err) {
            console.error('Failed to send transcript to archive channel:', err);
            await channel.send({ content: 'Could not send transcript to the archive channel.' });
        }
    } else {
        await channel.send({ content: 'Archive channel not found. The transcript will only be sent via DM.' });
    }
    
    // Attempt to DM the owner
    if (ticketOwner) {
        try {
            await ticketOwner.send({
                embeds: [transcriptEmbed.setFooter({ text: "Here is a copy of your ticket transcript."})],
                files: [transcript]
            });
        } catch (err) {
            await channel.send({ content: `Could not DM the ticket transcript to ${ticketOwner}. They may have DMs disabled.` });
        }
    }
    
    // Update DB with final info
    TicketData.closedAt = new Date();
    TicketData.closedBy = member.id;
    TicketData.transcriptURL = transcriptURL;
    await TicketData.save();

    // Finally, delete the channel after a short delay to allow messages to be read
    setTimeout(() => {
        channel.delete().catch(err => console.error(`Failed to delete ticket channel ${channel.id}:`, err));
    }, 5000); // 5 seconds
};