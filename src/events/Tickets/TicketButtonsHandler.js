const { Events, Client, Interaction, EmbedBuilder, Colors, ApplicationCommandOptionType, PermissionFlagsBits, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { SendEmbed, consoleLogData, ShortTimestamp } = require('../../utils/LoggingData');
const { TicketConfig, TicketInstance } = require('../../models/GuildSetups');
const { permissionCheck } = require('../../utils/Permissions');
const { createTranscript} = require('discord-html-transcripts');
require('dotenv').config();
const TicketsCache = require('../../cache/Tickets');

const {  } = process.env;

const handlers = {
    'ovx-ticket-create': require('../../handlers/Tickets/Create'),
    'ovx-ticket-close': require('../../handlers/Tickets/Close'),
    'ovx-ticket-lock': require('../../handlers/Tickets/Lock'),
    'ovx-ticket-unlock': require('../../handlers/Tickets/Unlock'),
};

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    nickname: 'Ticket Button Handler',

    /**
     * @param {Interaction} interaction - Discord Client
     */
    async execute(interaction) {
        
        if (!interaction.isButton()) return;
        if (!handlers[interaction.customId]) return;

        const { customId, client, guild, channel, member } = interaction;

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(channel, botPermissions, client);
        if (!hasPermission) return SendEmbed(interaction, Colors.Red, 'Tickets | Missing Permissions', `Bot Missing Permissions: \`${missingPermissions}\` in ${channel}`);

        const TicketData = await TicketInstance.findOne({ channelId: channel.id, guildId: guild.id });
        const TicketConfigData = await TicketsCache.get(guild.id);
        const isAdmin = member.roles.cache.has(TicketConfigData.adminRoleId) || member.permissions.has(PermissionFlagsBits.Administrator)
        const isMod = member.roles.cache.has(TicketConfigData.supportRoleId) || member.permissions.has(PermissionFlagsBits.ManageMessages);
        const ticketOwner = TicketData ? await guild.members.fetch(TicketData.memberId).catch(() => null) : null;

        const context = { TicketData, TicketConfigData, isAdmin, isMod, ticketOwner };

        const handler = handlers[customId];
        try {
            await handler(interaction, context);
        } catch (error) {
            console.error(error);
            SendEmbed(interaction, Colors.Red, 'Tickets | Error', `Error: \`${error.message}\``);
        }

    }
};