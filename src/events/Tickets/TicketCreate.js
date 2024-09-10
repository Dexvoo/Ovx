const { EmbedBuilder, Events, Interaction, PermissionsBitField, PermissionFlagsBits, ButtonStyle, ActionRowBuilder, ChannelType, ButtonBuilder } = require('discord.js');
const { UserTickets } = require('../../models/Tickets');
const { Tickets } = require('../../models/GuildSetups');
const { permissionCheck } = require('../../utils/Checks');
const { execute } = require('../Command Events/CommandIDs');

module.exports = {
    name: Events.InteractionCreate,
    nickname: 'Ticket Create',
    once: false,

    /**
     * @param {Interaction} interaction
     */

    async execute(interaction) {
        if (!interaction.isButton()) return;
    
        const { customId, user, guild, channel, member, client } = interaction;
    
        if (customId !== 'ovx-ticket-create') return;
    
        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(channel, botPermissions, client);
    
        if (!hasPermission) {
            const noPermissionEmbed = new EmbedBuilder()
                .setTitle('Tickets | Missing Permissions')
                .setDescription(`Bot Missing Permissions: \`${missingPermissions}\` in ${channel}`)
                .setColor('Red');
            return member.send({ embeds: [noPermissionEmbed] }).catch(() => { });
        }
    
        const ticketSetupData = await Tickets.findOne({ guildId: guild.id });
    
        if (!ticketSetupData) {
            const noTicketSetupEmbed = new EmbedBuilder()
                .setTitle('Tickets | Setup Required')
                .setDescription('You need to setup the ticket system before creating tickets.')
                .setColor('Red');
            return member.send({ embeds: [noTicketSetupEmbed] }).catch(() => { });
        }
    
        const ticketId = await UserTickets.find({ guildId: guild.id }).countDocuments() + 1;
    
        // Retrieve all tickets associated with the user in the guild
        const userTickets = await UserTickets.find({ memberId: user.id, guildId: guild.id });
    
        // Filter out invalid tickets (channels that no longer exist) and ensure the ticket is still open
        const openTickets = userTickets.filter(ticket => guild.channels.cache.has(ticket.ticketChannelId) && ticket.ticketOpen);
    
        // If there are valid open tickets, stop the process
        if (openTickets.length > 0) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`• You already have a ticket open, please close that one first •`)
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }
    
        // Prepare role permissions
        const everyoneRole = guild.roles.everyone;
        const permissions = [
            {
                id: client.user.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.EmbedLinks,
                ],
            },
            {
                id: everyoneRole.id,
                deny: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                ],
            },
            {
                id: ticketSetupData.supportRoleId,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                ],
            },
            {
                id: ticketSetupData.adminRoleId,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                ],
            },
            {
                id: member.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                ],
            },
        ];
    
        // Create the ticket channel
        try {
            const channel = await guild.channels.create({
                name: `${member.user.username}-${ticketId}`,
                reason: `Ticket Created by ${member.user.username}`,
                type: ChannelType.GuildText,
                parent: ticketSetupData.ticketCategoryId,
                permissionOverwrites: permissions,
            });
    
            // Save the ticket details in the database
            await UserTickets.create({
                guildId: guild.id,
                memberId: member.id,
                ticketId: ticketId,
                ticketChannelId: channel.id,
                ticketOpen: true,  // Mark the ticket as open
            });
    
            // Create and send the ticket embed
            const ticketEmbed = new EmbedBuilder()
                .setColor('Blurple')
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
            );
    
            await channel.send({
                content: `${member}`,
                embeds: [ticketEmbed],
                components: [buttonRow],
            });
    
            // Notify the user about the created ticket
            const confirmationEmbed = new EmbedBuilder()
                .setColor('Blurple')
                .setDescription(`• Ticket Created : ${channel} •`)
    
            await interaction.reply({ embeds: [confirmationEmbed], ephemeral: true });
    
        } catch (error) {
            console.log(error);
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`• There was an error creating your ticket. Please try again •`);
    
            await interaction.editReply({ embeds: [embed], ephemeral: true });
        }
    }
    
    
};
