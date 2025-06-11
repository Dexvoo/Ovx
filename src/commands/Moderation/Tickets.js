const { SlashCommandBuilder, Colors, CommandInteraction, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, EmbedBuilder, AutocompleteInteraction, GuildMember, Client, User, MessageFlags, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChatInputCommandInteraction, PermissionsBitField } = require('discord.js');
const { SendEmbed, consoleLogData, ShortTimestamp } = require('../../utils/LoggingData')
require('dotenv').config();
const ms = require('ms');
const { DeveloperIDs } = process.env;
const { TicketConfig, TicketInstance } = require('../../models/GuildSetups');
const { permissionCheck } = require('../../utils/Permissions');

const handlers = {
    'ovx-ticket-create': require('../../handlers/Tickets/Create'),
    'ovx-ticket-close': require('../../handlers/Tickets/Close'),
    'ovx-ticket-lock': require('../../handlers/Tickets/Lock'),
    'ovx-ticket-unlock': require('../../handlers/Tickets/Unlock'),
    'ovx-ticket-setup': require('../../handlers/Tickets/Setup'),
};

const TicketCache = require('../../cache/Tickets');

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
        .setDefaultMemberPermissions(PermissionsBitField.resolve([ PermissionFlagsBits.ManageGuild, PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers ]))
        
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
        const subcommand = interaction.options.getSubcommand();

        if(!handlers[`ovx-ticket-${subcommand}`]) return SendEmbed(interaction, Colors.Red, 'Tickets | Not Found', `The subcommand \`${subcommand}\` does not exist.`);

        const { client, guild, channel, member } = interaction;

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(channel, botPermissions, client);
        if (!hasPermission) return SendEmbed(interaction, Colors.Red, 'Tickets | Missing Permissions', `Bot Missing Permissions: \`${missingPermissions}\` in ${channel}`);

        const TicketData = await TicketInstance.findOne({ channelId: channel.id, guildId: guild.id });
        const TicketConfigData = await TicketCache.get(guild.id);
        TicketConfigData.adminRoleId
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