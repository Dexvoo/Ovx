const { Colors, ButtonInteraction, GuildMember, ButtonStyle, ButtonBuilder, ActionRowBuilder, CommandInteraction, PermissionFlagsBits } = require('discord.js');
const { TicketInstance, TicketConfig } = require('../../models/GuildSetups');
const { SendEmbed } = require('../../utils/LoggingData');
const TicketCache = require('../../cache/Tickets');

/**
 * @param {CommandInteraction} interaction
 * @param {{ TicketData: TicketInstance, TicketConfigData: TicketConfig, isAdmin: boolean, isMod: boolean, ticketOwner: GuildMember | null }} context
 */
module.exports = async function TicketSetup(interaction, context) {
    const { client, guild, channel, member, options } = interaction;
    const { TicketData, TicketConfigData, isAdmin, isMod, ticketOwner } = context;

    const enabled = options.getBoolean('enabled');
    const setupChannel = options.getChannel('setup-channel') || null;
    const ticketCategory = options.getChannel('ticket-category') || null;
    const archiveChannel = options.getChannel('archive-channel') || null;
    const supportRole = options.getRole('support-role') || null;
    const adminRole = options.getRole('admin-role') || null;
    const botMember = guild.members.me;


    if(!enabled) {
        const GuildTicketConfig = await TicketConfig.findOne({ guildId: guild.id });
        if(!GuildTicketConfig) return SendEmbed(interaction, Colors.Red, 'Failed Setup', 'Tickets are not setup on this server, `/ticket setup` to enable tickets', []);
        
        GuildTicketConfig.enabled = false;
        await GuildTicketConfig.save();

        return SendEmbed(interaction, Colors.Blurple, 'Ticket System Disabled', `Ticket system has been disabled`, [
            { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
        ]);
    };

    if(!setupChannel) return SendEmbed(interaction, Colors.Red, 'Failed Setup', 'Please provide a channel to send the ticket embed in', []);
    if(!ticketCategory) return SendEmbed(interaction, Colors.Red, 'Failed Setup', 'Please provide a category to put the tickets in', []);
    if(!archiveChannel) return SendEmbed(interaction, Colors.Red, 'Failed Setup', 'Please provide a channel to send the transcripts in', []);
    if(!supportRole) return SendEmbed(interaction, Colors.Red, 'Failed Setup', 'Please provide a support role to ping when a ticket is created', []);
    if(!adminRole) return SendEmbed(interaction, Colors.Red, 'Failed Setup', 'Please provide a admin role to ping when a ticket is created', []);

    const botPermissionsInSetUp = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels];
    const [hasSetupPermissions, missingSetupPermissions] = permissionCheck(setupChannel, botPermissionsInSetUp, client);
    if(!hasSetupPermissions) return SendEmbed(interaction, Colors.Red, 'Failed Setup', `Bot Missing Permissions | \`${missingSetupPermissions.join(', ')}\` in ${setupChannel}`, []);

    const botPermissionsInArchive = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
    const [hasArchivePermissions, missingArchivePermissions] = permissionCheck(archiveChannel, botPermissionsInArchive, client);
    if(!hasArchivePermissions) return SendEmbed(interaction, Colors.Red, 'Failed Setup', `Bot Missing Permissions | \`${missingArchivePermissions.join(', ')}\` in ${archiveChannel}`, []);

    const botPermissionsInCategory = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles];
    const [hasCategoryPermissions, missingCategoryPermissions] = permissionCheck(ticketCategory, botPermissionsInCategory, client);
    if(!hasCategoryPermissions) return SendEmbed(interaction, Colors.Red, 'Failed Setup', `Bot Missing Permissions | \`${missingCategoryPermissions.join(', ')}\` in ${ticketCategory}`, []);

    if(supportRole.position >= botMember.roles.highest.position || adminRole.position >= botMember.roles.highest.position) return SendEmbed(interaction, Colors.Red, 'Failed Setup', `Support roles are higher than the bot\'s role.`, []);

    const ticketsEmbedSuccess = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle(`${guild.name} | Tickets`)
        .setDescription('Welcome to our ticket channel. If you would like to talk to a staff member for assistance, please click the button below.');

    const ticketButton = new ButtonBuilder()
        .setStyle(ButtonStyle.Primary)
        .setLabel('Create Ticket')
        .setCustomId('ovx-ticket-create');

    const row = new ActionRowBuilder().addComponents(ticketButton);

    await setupChannel.send({ embeds: [ticketsEmbedSuccess], components: [row] });


    await TicketCache.set(guild.id, {
        enabled: true,
        setupChannelId: setupChannel.id,
        ticketCategoryId: ticketCategory.id,
        archiveChannelId: archiveChannel.id,
        supportRoleId: supportRole.id,
        adminRoleId: adminRole.id,
        lastTicketId: TicketConfigData?.lastTicketId || 0,
        maxTicketsPerUser: TicketConfigData?.maxTicketsPerUser || 3
    });

    return SendEmbed(interaction, Colors.Blurple, 'Ticket System Setup', `Ticket system has been setup successfully`, [
        { name: 'Setup Channel', value: setupChannel.toString(), inline: true },
        { name: 'Ticket Category', value: ticketCategory.toString(), inline: true },
        { name: 'Archive Channel', value: archiveChannel.toString(), inline: true },
        { name: 'Support Role', value: supportRole.toString(), inline: true },
        { name: 'Admin Role', value: adminRole.toString(), inline: true },
        { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: false }
    ]);

};