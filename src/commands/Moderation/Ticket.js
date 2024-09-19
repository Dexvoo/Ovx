const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, PermissionFlagsBits, parseEmoji, InteractionContextType, PermissionsBitField } = require('discord.js');
const { UserTickets } = require('../../models/Tickets');
const { Tickets } = require('../../models/GuildSetups');
const { createTranscript } = require('discord-html-transcripts');
module.exports = {
    cooldown: 5,
    category: 'Moderation',
    userpermissions: [PermissionFlagsBits.BanMembers],
    botpermissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels],
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Ticket Actions')
        .setContexts( InteractionContextType.Guild )
        
        .addSubcommand(subcommand => subcommand
            .setName('addmember')
            .setDescription('Add a member to a ticket')
            .addUserOption(option => option
                .setName('member')
                .setDescription('The member you want to add to the ticket')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('removemember')
            .setDescription('Remove a member from a ticket')
            .addUserOption(option => option
                .setName('member')
                .setDescription('The member you want to remove from the ticket')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('close')
            .setDescription('Close a ticket')
        )
        .addSubcommand(subcommand => subcommand
            .setName('lock')
            .setDescription('Lock a ticket')
        )
        .addSubcommand(subcommand => subcommand
            .setName('unlock')
            .setDescription('Unlock a ticket')
        ),
    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;
        const subcommand = options.getSubcommand();

        await interaction.deferReply();

        try {
            if(!guild) {
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle('Tickets | Invalid Server')
                    .setDescription('This command can only be used in a server!')
                return await interaction.editReply({ embeds: [Embed] });
            }

            const channelTicket = await UserTickets.findOne({ ticketChannelId: channel.id });

            if(!channelTicket) {
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle('Tickets | Invalid Ticket')
                    .setDescription('This channel is not a ticket!')
                return await interaction.editReply({ embeds: [Embed] });
                
            }

            const ticketOwnerMember = await guild.members.fetch(channelTicket.memberId).catch(() => { false });
            

            switch (subcommand) {
                case 'addmember': {
                    const memberToAdd = options.getUser('member');
            
                    if (!memberToAdd) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('Tickets | Missing Arguments')
                            .setDescription('Please provide a member to add!');
                        return await interaction.editReply({ embeds: [Embed] });
                    }
            
                    if (memberToAdd.id === client.user.id) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('Tickets | Missing Permissions')
                            .setDescription('You cannot add/remove the bot from a ticket!');
                        return await interaction.editReply({ embeds: [Embed] });
                    }
            
                    if (memberToAdd.id === member.id) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('Tickets | Missing Permissions')
                            .setDescription('You cannot add/remove yourself from a ticket!');
                        return await interaction.editReply({ embeds: [Embed] });
                    }
            
                    if (!channel.manageable) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('Tickets | Missing Permissions')
                            .setDescription('I cannot add this member to the ticket!');
                        return await interaction.editReply({ embeds: [Embed] });
                    }
            
                    channel.permissionOverwrites.create(memberToAdd.id, {
                        SendMessages: true,
                        ViewChannel: true,
                        ReadMessageHistory: true,
                    });
            
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Blurple)
                        .setTitle('Tickets | Add Member')
                        .setDescription(`Successfully added ${memberToAdd} to the ticket!`);
                    return await interaction.editReply({ embeds: [Embed] });
                }
                case 'removemember': {
                    const memberToRemove = options.getUser('member');
            
                    if (!memberToRemove) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('Tickets | Missing Arguments')
                            .setDescription('Please provide a member to remove!');
                        return await interaction.editReply({ embeds: [Embed] });
                    }
            
                    if (memberToRemove.id === client.user.id) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('Tickets | Missing Permissions')
                            .setDescription('You cannot add/remove the bot from a ticket!');
                        return await interaction.editReply({ embeds: [Embed] });
                    }
            
                    if (memberToRemove.id === member.id) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('Tickets | Missing Permissions')
                            .setDescription('You cannot add/remove yourself from a ticket!');
                        return await interaction.editReply({ embeds: [Embed] });
                    }
            
                    if (!channel.manageable) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('Tickets | Missing Permissions')
                            .setDescription('I cannot remove this member from the ticket!');
                        return await interaction.editReply({ embeds: [Embed] });
                    }
            
                    channel.permissionOverwrites.create(memberToRemove.id, {
                        SendMessages: false,
                        ViewChannel: false,
                        ReadMessageHistory: false,
                    });
            
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Blurple)
                        .setDescription(`Successfully removed ${memberToRemove} from the ticket!`);
                    return await interaction.editReply({ embeds: [Embed] });
                }
                case 'close': {
                    if (channelTicket.ticketOpen === false) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('Tickets | Already Closed')
                            .setDescription('This ticket is already closed!');
                        return await interaction.editReply({ embeds: [Embed] });
                    }
            
                    const transcript = await createTranscript(channel, {
                        favicon: client.user.displayAvatarURL({ dynamic: true }),
                        saveImages: true,
                        limit: 100,
                        filename: `${guild.name}-TicketId-${channelTicket.ticketId}.html`
                    });
            
                    const transcriptEmbed = new EmbedBuilder()
                        .setTitle('Tickets')
                        .setDescription(`Guild: ${guild.name} | Ticket ID: ${channelTicket.ticketId} | Closed by: ${member}`)
                        .setColor(Colors.Blurple);
            
                    const closeEmbed = new EmbedBuilder()
                        .setTitle('Tickets | Close Ticket')
                        .setDescription('This ticket will be closed in 10 seconds, enable DM\'s for the ticket transcript')
                        .setColor(Colors.Blurple);
            
                    const ticketData = await Tickets.findOne({ guildId: guild.id });
            
                    if (ticketData && ticketData.enabled) {
                        const archiveLogs = await guild.channels.fetch(ticketData.archiveChannelId).catch(() => {
                            const noArchiveEmbed = new EmbedBuilder()
                                .setDescription('Failed to send the transcript to the archive channel.')
                                .setColor(Colors.Red);
            
                            channel.send({ embeds: [noArchiveEmbed] }).catch(() => { });
                            return false;
                        });
            
                        if (archiveLogs) {
                            await archiveLogs.send({ embeds: [transcriptEmbed], files: [transcript] }).catch(() => { });
                        }
            
                        interaction.editReply({ embeds: [closeEmbed] });
            
                        setTimeout(async () => {
                            channel.delete().catch(() => { });
            
                            if (ticketOwnerMember) {
                                await ticketOwnerMember.send({ embeds: [transcriptEmbed], files: [transcript] }).catch(async () => {
                                    const noDMEmbed = new EmbedBuilder()
                                        .setDescription('Failed to send the transcript to the ticket owner.')
                                        .setColor(Colors.Red);
            
                                    await channel.send({ embeds: [noDMEmbed] }).catch(() => { });
                                });
                            }
                        }, 10000);
            
                        channelTicket.ticketOpen = false;
                        await channelTicket.save().catch(() => { });
            
                    } else {
                        const SomethingWentWrongEmbed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setDescription('Something went wrong while closing the ticket!');
                        return await interaction.editReply({ embeds: [SomethingWentWrongEmbed] });
                    }
                    break;
                }
                case 'lock': {
                    if (channelTicket.ticketLocked === true) {
                        const Embed = new EmbedBuilder()
                            .setTitle('Tickets | Already Locked')
                            .setColor(Colors.Red)
                            .setDescription('This ticket is already locked!');
                        return await interaction.editReply({ embeds: [Embed], ephemeral: true });
                    }
            
                    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                        const Embed = new EmbedBuilder()
                            .setTitle('Tickets | Missing Permissions')
                            .setColor(Colors.Red)
                            .setDescription('You are missing the `Manage Channels` permission!');
                        return await interaction.editReply({ embeds: [Embed] });
                    }
            
                    channelTicket.ticketLocked = true;
                    await channelTicket.save().catch(() => { });
            
                    const lockedEmbed = new EmbedBuilder()
                        .setTitle('Tickets | Lock Ticket')
                        .setDescription(`This ticket has been locked by ${member}`)
                        .setColor(Colors.Blurple);
            
                    await channel.permissionOverwrites.edit(ticketOwnerMember.user, {
                        SendMessages: false,
                        ViewChannel: false,
                        ReadMessageHistory: false,
                    });
            
                    return await interaction.editReply({ embeds: [lockedEmbed] });
                }
                case 'unlock': {
                    if (channelTicket.ticketLocked === false) {
                        const Embed = new EmbedBuilder()
                            .setTitle('Tickets | Already Unlocked')
                            .setColor(Colors.Red)
                            .setDescription('This ticket is already unlocked!');
                        return await interaction.editReply({ embeds: [Embed] });
                    }
            
                    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                        const Embed = new EmbedBuilder()
                            .setTitle('Tickets | Missing Permissions')
                            .setColor(Colors.Red)
                            .setDescription('You are missing the `Manage Channels` permission!');
                        return await interaction.editReply({ embeds: [Embed], ephemeral: true });
                    }
            
                    channelTicket.ticketLocked = false;
                    await channelTicket.save().catch(() => { });
            
                    const unlockedEmbed = new EmbedBuilder()
                        .setTitle('Tickets | Unlock Ticket')
                        .setDescription(`This ticket has been unlocked by ${member}`)
                        .setColor(Colors.Blurple);
            
                    await channel.permissionOverwrites.edit(ticketOwnerMember.user, {
                        SendMessages: true,
                        ViewChannel: true,
                        ReadMessageHistory: true,
                    });
            
                    return await interaction.editReply({ embeds: [unlockedEmbed] });
                }
            }

            
        } catch (error) {
            console.error(error);
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('There was an error while executing this command!')
            await interaction.editReply({ embeds: [Embed] });
        }
        
    }

};