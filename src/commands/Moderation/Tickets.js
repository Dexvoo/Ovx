const { SlashCommandBuilder, Colors, CommandInteraction, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, EmbedBuilder, AutocompleteInteraction, GuildMember, Client, User, MessageFlags, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChatInputCommandInteraction } = require('discord.js');
const { SendEmbed, consoleLogData, ShortTimestamp } = require('../../utils/LoggingData')
require('dotenv').config();
const ms = require('ms');
const { DeveloperIDs } = process.env;
const { TicketConfig, TicketInstance } = require('../../models/GuildSetups');
const { permissionCheck } = require('../../utils/Permissions');

const handlers = {
    'ovx-ticket-create': require('../../handlers/Tickets/Buttons/Create'),
    'ovx-ticket-close': require('../../handlers/Tickets/Buttons/Close'),
    'ovx-ticket-lock': require('../../handlers/Tickets/Buttons/Lock'),
    'ovx-ticket-unlock': require('../../handlers/Tickets/Buttons/Unlock'),
};

module.exports = {
    cooldown: 0,
    category: 'Moderation',
    userpermissions: [ PermissionFlagsBits.Administrator ],
    botpermissions: [ PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageRoles ],
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Add/Remove members, Lock/Unlock tickets, Open/Close tickets, Setup tickets')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers | PermissionFlagsBits.ModerateMembers)
        
        .addSubcommand(subcommand => subcommand
            .setName('setup')
            .setDescription('Setup ticket system for your server.')
            .addBooleanOption(option => option
                .setName('enabled')
                .setDescription('Enable or disable ticket system.')
                .setRequired(true)
            )
            .addChannelOption(option => option
                .setName('setup-channel')
                .setDescription('Channel to send the ticket embed in.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
            .addChannelOption(option => option
                .setName('ticket-category')
                .setDescription('Category to put the tickets in.')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(false)
            )
            .addChannelOption(option => option
                .setName('archive-channel')
                .setDescription('Channel to send transcripts in.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
            .addRoleOption(option => option
                .setName('support-role')
                .setDescription('Role to ping when a ticket is created.')
                .setRequired(false)
            )
            .addRoleOption(option => option
                .setName('admin-role')
                .setDescription('Role to ping when a ticket is created.')
                .setRequired(false)
            )
        )
        
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
    * @param {ChatInputCommandInteraction} interaction
    */

    async execute(interaction) {
        
        console.log(interaction.commandName)
        if(!interaction.isCommand()) return;
        const subcommand = interaction.options.getSubcommand();

        if(!handlers[`ovx-ticket-${subcommand}`]) return SendEmbed(interaction, Colors.Red, 'Tickets | Not Found', `The subcommand \`${subcommand}\` does not exist.`);

        const { client, guild, channel, member } = interaction;

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(channel, botPermissions, client);
        if (!hasPermission) return SendEmbed(interaction, Colors.Red, 'Tickets | Missing Permissions', `Bot Missing Permissions: \`${missingPermissions}\` in ${channel}`);

        const TicketData = await TicketInstance.findOne({ channelId: channel.id, guildId: guild.id });
        const TicketConfigData = await TicketConfig.findOne({ guildId: guild.id });
        const isAdmin = member.roles.cache.has(TicketConfigData?.adminRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);
        const isMod = member.roles.cache.has(TicketConfigData?.supportRoleId) || member.permissions.has(PermissionFlagsBits.ManageMessages);
        const ticketOwner = TicketData ? await guild.members.fetch(TicketData.memberId).catch(() => null) : null;

        const context = { TicketData, TicketConfigData, isAdmin, isMod, ticketOwner };

        const handler = handlers[`ovx-ticket-${subcommand}`];

        try {
            await handler(interaction, context);
        } catch (error) {
            console.error(error);
            SendEmbed(interaction, Colors.Red, 'Tickets | Error', `Error: \`${error.message}\``);
            
        }

    }
};

/**
* @param {CommandInteraction} interaction
*/
async function SetupTickets(interaction) {
    const { options, guild, client, member } = interaction;

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
    }

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

    await TicketConfig.findOneAndUpdate(
        { guildId: guild.id }, 
        { enabled: true,
        setupChannelId: setupChannel.id,
        ticketCategoryId: ticketCategory.id,
        archiveChannelId: archiveChannel.id,
        supportRoleId: supportRole.id,
        adminRoleId: adminRole.id }, 
        { upsert: true }
    );

    return SendEmbed(interaction, Colors.Blurple, 'Ticket System Setup', `Ticket system has been setup successfully`, [
        { name: 'Setup Channel', value: setupChannel.toString(), inline: true },
        { name: 'Ticket Category', value: ticketCategory.toString(), inline: true },
        { name: 'Archive Channel', value: archiveChannel.toString(), inline: true },
        { name: 'Support Role', value: supportRole.toString(), inline: true },
        { name: 'Admin Role', value: adminRole.toString(), inline: true },
        { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: false }
    ]);
};