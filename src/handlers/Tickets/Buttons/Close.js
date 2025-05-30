const { Colors, EmbedBuilder, ButtonInteraction, GuildMember } = require('discord.js');
const { TicketInstance, TicketConfig } = require('../../../models/GuildSetups');
const { createTranscript } = require('discord-html-transcripts');
const { SendEmbed } = require('../../../utils/LoggingData');

const CLOSE_DELAY = 10_000;

/**
 * @param {ButtonInteraction} interaction
 * @param {{ TicketData: TicketInstance, TicketConfigData: TicketConfig, isAdmin: boolean, isMod: boolean, ticketOwner: GuildMember | null }} context
 */
module.exports = async function TicketClose(interaction, context) {
    const { client, guild, channel, member } = interaction;
    const { TicketData, TicketConfigData, isAdmin, isMod, ticketOwner } = context;
    const isOwner = TicketData?.memberId === member.id;

    if(!TicketConfigData?.enabled) return SendEmbed(interaction, Colors.Red, 'Tickets | Not Enabled', 'Tickets are not enabled on this server. Please contact an admin.');
    if(!TicketData?.open) return SendEmbed(interaction, Colors.Red, 'Tickets | Already Closed', 'This ticket is already closed.');
    if(!isAdmin && !isMod && !isOwner) return SendEmbed(interaction, Colors.Red, 'Tickets | Permission Denied', 'You do not have permission to close this ticket.');

    let transcript;
    try {
        transcript = await createTranscript(channel, {
            favicon: client.user.displayAvatarURL({ dynamic: true }),
            saveImages: true,
            limit: 100,
            filename: `${guild.name}-TicketId-${TicketData.ticketId}.html`
        });
    } catch (error) {
        console.error('Transcript creation failed:', error);
        return SendEmbed(interaction, Colors.Red, 'Tickets | Error', 'Failed to create transcript.');
    }

    const transcriptEmbed = new EmbedBuilder()
        .setTitle('Tickets ')
        .setDescription(`Guild: ${guild.name} | Ticket ID: ${TicketData.ticketId} | Closed by: ${member}`)
        .setColor(Colors.Blurple);

    SendEmbed(interaction, Colors.Blurple, 'Tickets | Close Ticket', `This ticket will be closed in 10 seconds, enable DMs for the ticket transcript`, [], false);

    const archiveLogChannel = await guild.channels.fetch(TicketConfigData.archiveChannelId).catch(async () => {
        const noArchiveEmbed = new EmbedBuilder()
            .setTitle('Tickets | Archive Channel Not Found')
            .setDescription('The archive channel is not set up correctly. Please contact an admin.')
            .setColor(Colors.Red);
        await channel.send({ embeds: [noArchiveEmbed] }).catch(() => { });
    });

    let transcriptURL = '';
    if (archiveLogChannel) {
        await archiveLogChannel.send({ embeds: [transcriptEmbed], files: [transcript] }).then(async (message) => {
            transcriptURL = message.attachments.first()?.url || '';
            console.log(`Transcript URL: ${transcriptURL}`);
        });
    };

    setTimeout(async () => {
        channel.delete().catch(() => { });
        
        if(ticketOwner) {
            await ticketOwner.send({ embeds: [transcriptEmbed], files: [transcript] }).catch(async () => { 
                const noDMEmbed = new EmbedBuilder()
                    .setTitle('Tickets | DM Disabled')
                    .setDescription('You have DMs disabled, the ticket transcript will not be sent to you.')
                    .setColor(Colors.Red);
                await channel.send({ embeds: [noDMEmbed] }).catch(() => { });
            });
        };
            
        TicketData.open = false;
        TicketData.closedAt = new Date();
        TicketData.transcriptURL = transcriptURL
        await TicketData.save();
    }, CLOSE_DELAY);

};