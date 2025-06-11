const { Colors, ButtonInteraction, GuildMember, ButtonStyle, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const { TicketInstance, TicketConfig } = require('../../models/GuildSetups');
const { SendEmbed } = require('../../utils/LoggingData');

/**
 * @param {ButtonInteraction} interaction
 * @param {{ TicketData: TicketInstance, TicketConfigData: TicketConfig, isAdmin: boolean, isMod: boolean, ticketOwner: GuildMember | null }} context
 */
module.exports = async function TicketLock(interaction, context) {
    const { client, guild, channel, member } = interaction;
    const { TicketData, TicketConfigData, isAdmin, isMod, ticketOwner } = context;

    if(!TicketConfigData?.enabled) return SendEmbed(interaction, Colors.Red, 'Tickets | Not Enabled', 'Tickets are not enabled on this server. Please contact an admin.');
    if(TicketData?.locked) return SendEmbed(interaction, Colors.Red, 'Tickets | Already Locked', 'This ticket is already locked.');
    if(!isAdmin) return SendEmbed(interaction, Colors.Red, 'Tickets | Permission Denied', 'You do not have permission to close this ticket.');

    await channel.permissionOverwrites.edit(TicketData.memberId, { ViewChannel: false, SendMessages: false, ReadMessageHistory: false }).catch(err => {
        console.error('Failed to lock ticket:', err);
        return SendEmbed(interaction, Colors.Red, 'Tickets | Error', 'Failed to lock the ticket. Please try again later.');
    });

    const buttonMessageLock = await channel.messages.fetch(TicketData.buttonId).catch(() => null);
    if(buttonMessageLock) {
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ovx-ticket-close')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('❌'),
            new ButtonBuilder()
                .setCustomId('ovx-ticket-lock')
                .setLabel('Lock Ticket')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔐')
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('ovx-ticket-unlock')
                .setLabel('Unlock Ticket')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔓')
                .setDisabled(false)
        );
        
        await buttonMessageLock.edit({ components: [buttonRow] }).catch(() => { });
    };
    
    SendEmbed(interaction, Colors.Blurple, `Tickets | Lock Ticket`, `This ticket has been locked by ${member}. Only admins can unlock it now.`, [], false);    
    
    TicketData.locked = true;
    await TicketData.save();

};