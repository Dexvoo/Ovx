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

    if(!TicketConfigData?.enabled) return client.utils.Embed(interaction, Colors.Red, 'Tickets | Not Enabled', 'Tickets are not enabled on this server. Please contact an admin.');
    if(!TicketData?.open) {
        //
        if(TicketData.channelId !== null) {
            const ticketChannel = client.channels.cache.get(TicketData.channelId) || await client.channels.fetch(TicketData.channelId).catch(() => {return false});

            if(ticketChannel) {
                await ticketChannel.delete()
                console.log('Deleting ticket channel because supposed to be closed')
                
            }
        }
    }
    if(!isAdmin && !isMod && !isOwner) return client.utils.Embed(interaction, Colors.Red, 'Tickets | Permission Denied', 'You do not have permission to close this ticket.');

    let transcript;
    try {
        transcript = await createTranscript(channel, {
            favicon: client.user.displayAvatarURL({ dynamic: true }),
            saveImages: true,
            limit: 100,
            filename: `${guild.name}-TicketId-${TicketData.ticketId}.html`,
            hydrate: true,
            poweredBy: false,
        });
    } catch (error) {
        console.error('Transcript creation failed:', error);
        return client.utils.Embed(interaction, Colors.Red, 'Tickets | Error', 'Failed to create transcript.');
    }

    const transcriptEmbed = new EmbedBuilder()
        .setTitle('Tickets ')
        .setDescription(`Guild: ${guild.name} | Ticket ID: ${TicketData.ticketId} | Opened by: ${ticketOwner} | Closed by: ${member}`)
        .setColor(Colors.Blurple);

    client.utils.Embed(interaction, Colors.Blurple, 'Tickets | Close Ticket', `This ticket will be closed in 10 seconds, enable DMs for the ticket transcript`, [], false);

    const archiveLogChannel = await guild.channels.fetch(TicketConfigData.archiveChannelId).catch(async () => {
        const noArchiveEmbed = new EmbedBuilder()
            .setTitle('Tickets | Archive Channel Not Found')
            .setDescription('The archive channel is not set up correctly. Please contact an admin.')
            .setColor(Colors.Red);
        await channel.send({ embeds: [noArchiveEmbed] }).catch(() => { });
    });

    let transcriptURL = '';
    if (archiveLogChannel) {
        await archiveLogChannel.send({ embeds: [transcriptEmbed], files: [transcript]}).then(async (message) => {
            transcriptURL = message.attachments.first()?.url || '';
        });
    };

    setTimeout(async () => {
        channel.delete().catch(() => { });
        
        if(ticketOwner) {
            await ticketOwner.send({ embeds: [transcriptEmbed], files: [transcript], flags: [MessageFlags.ShouldShowLinkNotDiscordWarning]}).catch(async () => { 
                const noDMEmbed = new EmbedBuilder()
                    .setTitle('Tickets | DM Disabled')
                    .setDescription('You have DMs disabled, the ticket transcript will not be sent to you.')
                    .setColor(Colors.Red);
                await channel.send({ embeds: [noDMEmbed] }).catch(() => { });
            });
        };
            
        TicketData.open = false;
        TicketData.closedAt = new Date();
        TicketData.closedBy = member.id
        TicketData.transcriptURL = transcriptURL
        await TicketData.save();
    }, CLOSE_DELAY);

};