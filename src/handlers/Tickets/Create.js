const { Colors, EmbedBuilder, ButtonInteraction, GuildMember, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { TicketInstance, TicketConfigType } = require('../../models/GuildSetups');
const { SendEmbed } = require('../../utils/LoggingData');
const { permissionCheck } = require('../../utils/Permissions');
const TicketsCache = require('../../cache/Tickets');

/**
 * @param {ButtonInteraction} interaction
 * @param {{ TicketData: TicketInstance, TicketConfigData: Partial<TicketConfigType>, isAdmin: boolean, isMod: boolean, ticketOwner: GuildMember | null }} context
 */
module.exports = async function TicketCreate(interaction, context) {
    const { client, guild, channel, member, user } = interaction;
    const { TicketData, TicketConfigData, isAdmin, isMod, ticketOwner } = context;

    if(!TicketConfigData?.enabled) return SendEmbed(interaction, Colors.Red, 'Tickets | Not Enabled', 'Tickets are not enabled on this server. Please contact an admin.');

    const userTickets = await TicketInstance.find({ memberId: user.id, guildId: guild.id });
    const openTickets = userTickets.filter(ticket => guild.channels.cache.has(ticket.channelId) && ticket.open);
    if(openTickets?.length >= TicketConfigData.maxTicketsPerUser) return SendEmbed(interaction, Colors.Red, 'Tickets | Limit Reached', `You have reached the maximum number of tickets (${TicketConfigData.maxTicketsPerUser}) allowed.`);

    const ticketCategory = guild.channels.cache.get(TicketConfigData.ticketCategoryId);
    if (!ticketCategory) return SendEmbed(interaction, Colors.Red, 'Tickets | Category Not Found', 'The ticket category is not set up correctly. Please contact an admin.');

    const botPermissionsInCategory = [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageRoles];
    const [hasCategoryPermissions, missingCategoryPermissions] = permissionCheck(ticketCategory, botPermissionsInCategory, client);
    if(!hasCategoryPermissions) return SendEmbed(interaction, Colors.Red, 'Failed Setup', `Bot Missing Permissions | \`${missingCategoryPermissions.join(', ')}\` in ${ticketCategory}`, []);

    TicketConfigData.lastTicketId += 1;
    
    await TicketsCache.set(guild.id, TicketConfigData);
    const ticketId = TicketConfigData.lastTicketId.toString().padStart(4, '0');
    
    const ticketChannel = await guild.channels.create({
        name: `${user.username}-${ticketId}`,
        reason: `Ticket created by ${user.tag} (${user.id})`,
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        permissionOverwrites: [
            {
                id: client.user.id,
                allow: [ PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.EmbedLinks ],
            },
            {
                id: guild.roles.everyone.id,
                deny: [ PermissionsBitField.Flags.ViewChannel ],
                allow: [ PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages ]
            },
            {
                id: TicketConfigData.supportRoleId,
                allow: [ PermissionsBitField.Flags.ViewChannel],
            },
            {
                id: TicketConfigData.adminRoleId,
                allow: [ PermissionsBitField.Flags.ViewChannel],
            },
            {
                id: member.id,
                allow: [ PermissionsBitField.Flags.ViewChannel ],
            },
        ],
    });


    const TicketEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle(`${guild.name} - Ticket: ${ticketId}`)
        .setDescription('• Our team will contact you shortly, please describe your issue •')

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
            .setEmoji('🔐'),
        new ButtonBuilder()
            .setCustomId('ovx-ticket-unlock')
            .setLabel('Unlock Ticket')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔓')
            .setDisabled(true)
    );

    const ticketButtonMessage = await ticketChannel.send({
        embeds: [TicketEmbed],
        content: `Ticket created by <@${user.id}>`,
        components: [buttonRow]
    });

    const newTicket = new TicketInstance({
        guildId: guild.id,
        memberId: user.id,
        ticketId: ticketId,
        channelId: ticketChannel.id,
        buttonId: ticketButtonMessage.id,
    });

    await newTicket.save();
    return SendEmbed(interaction, Colors.Blurple, 'Ticket Created', `Your ticket has been created: ${ticketChannel}`);

};