const { EmbedBuilder, Events, Interaction, PermissionsBitField, PermissionFlagsBits, ButtonStyle, ActionRowBuilder, ChannelType, ButtonBuilder } = require('discord.js');
const { UserTickets } = require('../../models/Tickets');
const { Tickets } = require('../../models/GuildSetups');
const { permissionCheck } = require('../../utils/Checks');
const { execute } = require('../Command Events/CommandIDs');
const { createTranscript } = require('discord-html-transcripts');
const { DeveloperMode } = process.env;

module.exports = {
    name: Events.InteractionCreate,
    nickname: 'Ticket Buttons',
    once: false,

    /**
     * @param {Interaction} interaction
     */

    async execute(interaction) {
        if (!interaction.isButton() || DeveloperMode === 'true') return;
    
        const { customId, user, guild, channel, member, client } = interaction;
    
        if (![ 'ovx-ticket-close', 'ovx-ticket-lock', 'ovx-ticket-unlock' ].includes(customId)) return;


        const botPermissions = [PermissionFlagsBits.ManageChannels];
        const [hasPermission, missingPermissions] = permissionCheck(channel, botPermissions, client);

        if (!hasPermission) {
            const noPermissionEmbed = new EmbedBuilder()
                .setTitle('Tickets | Missing Permissions')
                .setDescription(`Bot Missing Permissions: \`${missingPermissions}\` in ${channel}`)
                .setColor('Red');
            return member.send({ embeds: [noPermissionEmbed] }).catch(() => { });
        }

        const channelTicket = await UserTickets.findOne({ ticketChannelId: channel.id });

        if (!channelTicket) {
            const noTicketEmbed = new EmbedBuilder()
                .setTitle('Tickets | Invalid Ticket')
                .setDescription('This channel is not a ticket.')
                .setColor('Red');
            return member.send({ embeds: [noTicketEmbed] }).catch(() => { });
        }

        const ticketOwnerMember = await guild.members.fetch(channelTicket.memberId).catch(() => { false });

        switch (customId) {
            case 'ovx-ticket-close':
                if (!channelTicket.ticketOpen) {
                    const alreadyClosedEmbed = new EmbedBuilder()
                        .setTitle('Tickets | Already Closed')
                        .setDescription('This ticket is already closed.')
                        .setColor('Red');

                    return interaction.reply({ embeds: [alreadyClosedEmbed], ephemeral: true });
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
                    .setColor('Blurple');
                
                const closeEmbed = new EmbedBuilder()
                .setTitle('Tickets | Close Ticket')
                .setDescription('This ticket will be closed in 10 seconds, enable DM\'s for the ticket transcript')
                .setColor('Blurple');
                
                
                const ticketData = await Tickets.findOne({ guildId: guild.id });

                if(ticketData && ticketData.enabled) {
                    const archiveLogs = await guild.channels.fetch(ticketData.archiveChannelId).catch(() => {
                        const noArchiveEmbed = new EmbedBuilder()
                            .setDescription('Failed to send the transcript to the archive channel.')
                            .setColor('Red');

                            channel.send({ embeds: [noArchiveEmbed] }).catch(() => { });
                        return false;
                    });
                    
                    if(archiveLogs) {
                        await archiveLogs.send({ embeds: [transcriptEmbed], files: [transcript] }).catch(() => { });
                    }

                    interaction.reply({ embeds: [closeEmbed] });

                    setTimeout(async () => {
                        channel.delete().catch(() => { });

                        if(ticketOwnerMember) {
                            await ticketOwnerMember.send({ embeds: [transcriptEmbed], files: [transcript] }).catch(async () => { 
                                const noDMEmbed = new EmbedBuilder()
                                    .setDescription('Failed to send the transcript to the ticket owner.')
                                    .setColor('Red');
                                    await channel.send({ embeds: [noDMEmbed] }).catch(() => { });
                            });
                        }
                    }, 10000);

                    channelTicket.ticketOpen = false;
                    await channelTicket.save();

                    return;
                }

                const somethingWentWrongEmbed = new EmbedBuilder()
                    .setDescription('Something went wrong while closing the ticket.')
                    .setColor('Red');
                await channel.send({ embeds: [somethingWentWrongEmbed] }).catch(() => { });
                
                break;
            case 'ovx-ticket-lock':

                if (channelTicket.ticketLocked) {
                    const alreadyLockedEmbed = new EmbedBuilder()
                        .setTitle('Tickets | Already Locked')
                        .setDescription('This ticket is already locked.')
                        .setColor('Red');

                    return interaction.reply({ embeds: [alreadyLockedEmbed], ephemeral: true });
                }

                if(!member.permissions.has(PermissionsBitField.ManageChannels)) {
                    const noPermissionEmbed = new EmbedBuilder()
                        .setTitle('Tickets | Missing Permissions')
                        .setDescription('You are missing the `Manage Channels` permission.')
                        .setColor('Red');
                    return interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });
                }

                channelTicket.ticketLocked = true;
                await channelTicket.save();

                const lockedEmbed = new EmbedBuilder()
                    .setTitle('Tickets | Lock Ticket')
                    .setDescription(`This ticket has been locked by ${member}`)
                    .setColor('Blurple');


                    await channel.permissionOverwrites.edit(ticketOwnerMember.user, {
                        SendMessages: false,
                    }).catch((error) => { console.log(error) });

                await interaction.reply({ embeds: [lockedEmbed] });
                break;
            case 'ovx-ticket-unlock':
                if (!channelTicket.ticketLocked) {
                    const alreadyUnlockedEmbed = new EmbedBuilder()
                        .setTitle('Tickets | Already Unlocked')
                        .setDescription('This ticket is already unlocked.')
                        .setColor('Red');

                    return interaction.reply({ embeds: [alreadyUnlockedEmbed], ephemeral: true });
                }

                if(!member.permissions.has(PermissionsBitField.ManageChannels)) {
                    const noPermissionEmbed = new EmbedBuilder()
                        .setTitle('Tickets | Missing Permissions')
                        .setDescription('You are missing the `Manage Channels` permission.')
                        .setColor('Red');
                    return interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });
                }

                channelTicket.ticketLocked = false;
                await channelTicket.save();

                const unlockedEmbed = new EmbedBuilder()
                    .setTitle('Tickets | Unlock Ticket')
                    .setDescription(`This ticket has been unlocked by ${member}`)
                    .setColor('Blurple');

                    await channel.permissionOverwrites.edit(ticketOwnerMember.user, {
                        SendMessages: false,
                    }).catch((error) => { console.log(error) });

                await interaction.reply({ embeds: [unlockedEmbed] });
                break;
        }
       
    }
    
    
};
