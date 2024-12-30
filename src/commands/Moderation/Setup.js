const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, PermissionFlagsBits, InteractionContextType, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, parseEmoji, StringSelectMenuBuilder, ApplicationIntegrationType } = require('discord.js');
const { InviteDetection, LevelNotifications, ChannelLogs, MessageLogs, VoiceLogs, RoleLogs, ServerLogs, PunishmentLogs, JoinLeaveLogs, ReactionRoles, Tickets, AutoRoles, WelcomeMessage, LeaveMessage } = require('../../models/GuildSetups.js');
const { permissionCheck } = require('../../utils/Checks.js');

module.exports = {
    cooldown: 5,
    category: 'Moderation',
    userpermissions: [PermissionFlagsBits.ManageGuild],
    botpermissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageRoles],
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup the bot for your server.')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )
        .addSubcommandGroup(group => group
            .setName('guild')
            .setDescription('Setup the bot for your server.')
            .addSubcommand(subcommand => subcommand
                .setName('invitedetection')
                .setDescription('Setup the bot for your server.')
                .addBooleanOption(option => option
                    .setName('enabled')
                    .setDescription('Enable or disable invite detection.')
                    .setRequired(true)
                )
            )
            .addSubcommand(subcommand => subcommand
                .setName('levels')
                .setDescription('Setup level system for your server.')
                .addBooleanOption(option => option
                    .setName('enabled')
                    .setDescription('Enable or disable level system.')
                    .setRequired(true)
                )
                .addChannelOption(option => option
                    .setName('channel')
                    .setDescription('Set the channel for level up messages.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(false)
                )
            )

            .addSubcommand(subcommand => subcommand
                .setName('levelblacklist')
                .setDescription('Setup level blacklist for your server.')
                .addStringOption(option => option
                    .setName('type')
                    .setDescription('Add or remove roles/channels from the blacklist.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Add', value: 'add' },
                        { name: 'Remove', value: 'remove' },
                        { name: 'List', value: 'list' }
                    )

                )
                .addRoleOption(option => option
                    .setName('role')
                    .setDescription('Set the role for the blacklist.')
                    .setRequired(false)
                )
                .addChannelOption(option => option
                    .setName('channel')
                    .setDescription('Set the channel for the blacklist.')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
                    .setRequired(false)
                )
            )


            .addSubcommand(subcommand => subcommand
                .setName('levelrewards')
                .setDescription('Setup level rewards for your server.')
                .addStringOption(option => option
                    .setName('type')
                    .setDescription('Add or remove level rewards.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Add', value: 'add' },
                        { name: 'Remove', value: 'remove' },
                        { name: 'List', value: 'list' }
                    )
                )
                .addRoleOption(option => option
                    .setName('role')
                    .setDescription('Set the role for level rewards.')
                    .setRequired(false)
                )
                .addIntegerOption(option => option
                    .setName('level')
                    .setDescription('Set the level for the role.')
                )
            )
            
            .addSubcommand(subcommand => subcommand
                .setName('welcomemessages')
                .setDescription('Setup welcome messages for your server.')
                .addBooleanOption(option => option
                    .setName('enabled')
                    .setDescription('Enable or disable welcome messages.')
                    .setRequired(true)
                )
                .addChannelOption(option => option
                    .setName('channel')
                    .setDescription('Channel to send the welcomes in.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(false)
                )
                .addStringOption(option => option
                    .setName('message')
                    .setDescription('Set the message for the welcome ({server}, {username}, {usermention}, {memberCount})')
                    .setRequired(false)
                )
            )

            .addSubcommand(subcommand => subcommand
                .setName('leavemessages')
                .setDescription('Setup leaving messages for your server.')
                .addBooleanOption(option => option
                    .setName('enabled')
                    .setDescription('Enable or disable leave messages.')
                    .setRequired(true)
                )
                .addChannelOption(option => option
                    .setName('channel')
                    .setDescription('Channel to send the message in.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(false)
                )
                .addStringOption(option => option
                    .setName('message')
                    .setDescription('Set the message for the leave ({server}, {username}, {usermention}, {memberCount})')
                    .setRequired(false)
                )
            )
                
            .addSubcommand(subcommand => subcommand
                .setName('tickets')
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
                .setName('logs')
                .setDescription('Setup logging for your server.')
                .addStringOption(option => option
                    .setName('type')
                    .setDescription('Type of logs to setup.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Message', value: 'message' },
                        { name: 'Channel', value: 'channel' },
                        { name: 'Joins/Leaves', value: 'joinleave' },
                        { name: 'Voice', value: 'voice' },
                        { name: 'Role', value: 'role' },
                        { name: 'Server', value: 'server' },
                        { name: 'Punishment', value: 'punishment' },
                        { name: 'ALL Logs', value: 'all' },
                    )
                )
                .addBooleanOption(option => option
                    .setName('enabled')
                    .setDescription('Enable or disable logs.')
                    .setRequired(true)
                )
                .addChannelOption(option => option
                    .setName('channel')
                    .setDescription('Set the channel for logs.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(false)
                )


            )
            .addSubcommand(subcommand => subcommand
                .setName('reactionroles')
                .setDescription('Setup reaction roles for your server.')
                .addStringOption(option => option
                    .setName('type')
                    .setDescription('Add or remove reaction roles.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Add', value: 'add' },
                        { name: 'Remove', value: 'remove' },
                        { name: 'List', value: 'list' }
                    )
                )
                .addRoleOption(option => option
                    .setName('role')
                    .setDescription('Set the role for reaction roles.')
                    .setRequired(false)
                )
                .addStringOption(option => option
                    .setName('emoji')
                    .setDescription('Set the emoji for the role.')
                    .setRequired(false)
                )
                .addStringOption(option => option
                    .setName('messageid')
                    .setDescription('Message ID for the reaction role(in current channel).')
                    .setRequired(false)
                )
                .addStringOption(option => option
                    .setName('title')
                    .setDescription('Set the title for the reaction role embed.')
                    .setRequired(false)
                )
            )
            .addSubcommand(subcommand => subcommand
                .setName('autoroles')
                .setDescription('Setup auto roles for your server.')
                .addStringOption(option => option
                    .setName('type')
                    .setDescription('Add or remove auto roles when new members join.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Add', value: 'add' },
                        { name: 'Remove', value: 'remove' },
                        { name: 'List', value: 'list' }
                    )
                )
                .addBooleanOption(option => option
                    .setName('enabled')
                    .setDescription('Enable or disable auto roles.')
                    .setRequired(false)
                )
                .addRoleOption(option => option
                    .setName('role')
                    .setDescription('Set the role for auto roles.')
                    .setRequired(false)
                )
            )


        ),
    /**
     * @param {CommandInteraction} interaction
     */
    async execute(interaction) {
        const { options, guild, client } = interaction;
        const subGroup = options.getSubcommandGroup();
        const subcommand = options.getSubcommand();

        try {
            switch (subGroup) {
                case 'guild':
                    switch (subcommand) {
                        case 'invitedetection':
                            await handleInviteDetection(interaction);
                            break;
                        case 'levels':
                            await handleLevels(interaction);
                            break;
                        case 'levelblacklist':
                            await handleLevelBlacklist(interaction);
                            break;
                        case 'levelrewards':
                            await handleLevelRewards(interaction);
                            break;
                        case 'tickets':
                            await handleTickets(interaction);
                            break;
                        case 'logs':
                            
                            const type = options.getString('type');
                            const enabled = options.getBoolean('enabled');
                            const channel = options.getChannel('channel');

                            if(!channel && enabled) {
                                const Embed = new EmbedBuilder()
                                    .setColor(Colors.Red)
                                    .setDescription('Please provide a channel for logs');
                                return await interaction.reply({ embeds: [Embed], ephemeral: true });
                            }

                            switch (type) {
                                case 'message':

                                    if(enabled) {
                                        const botPermissionsInMessage = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
                                        const [hasMessagePermissions, missingMessagePermissions] = permissionCheck(channel, botPermissionsInMessage, client);
    
                                        if (!hasMessagePermissions) {
                                            const MessageEmbed = new EmbedBuilder()
                                                .setColor(Colors.Red)
                                                .setDescription(`Bot Missing Permissions: \`${missingMessagePermissions}\` in ${channel}`);
                                            return await interaction.reply({ embeds: [MessageEmbed], ephemeral: true });
                                        }
                                        
                                    }

                                    await MessageLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true });

                                    const MessageEmbed = new EmbedBuilder()
                                        .setColor(Colors.Blurple)
                                        .setDescription(`Message Logs have been ${enabled ? 'enabled' : 'disabled'}`);

                                    await interaction.reply({ embeds: [MessageEmbed], ephemeral: true });

                                    break;
                                case 'channel':

                                    if(enabled) {
                                        const botPermissionsInChannel = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
                                        const [hasChannelPermissions, missingChannelPermissions] = permissionCheck(channel, botPermissionsInChannel, client);
    
                                        if (!hasChannelPermissions) {
                                            const ChannelEmbed = new EmbedBuilder()
                                                .setColor(Colors.Red)
                                                .setDescription(`Bot Missing Permissions: \`${missingChannelPermissions}\` in ${channel}`);
                                            return await interaction.reply({ embeds: [ChannelEmbed], ephemeral: true });
                                        }
                                        
                                    }

                                    await ChannelLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true });
                                    
                                    const ChannelEmbed = new EmbedBuilder()
                                        .setColor(Colors.Blurple)
                                        .setDescription(`Channel Logs have been ${enabled ? 'enabled' : 'disabled'}`);

                                    await interaction.reply({ embeds: [ChannelEmbed], ephemeral: true });
                                    
                                    break;
                                case 'voice':

                                    if(enabled) {
                                        const botPermissionsInVoice = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
                                        const [hasVoicePermissions, missingVoicePermissions] = permissionCheck(channel, botPermissionsInVoice, client);
    
                                        if (!hasVoicePermissions) {
                                            const VoiceEmbed = new EmbedBuilder()
                                                .setColor(Colors.Red)
                                                .setDescription(`Bot Missing Permissions: \`${missingVoicePermissions}\` in ${channel}`);
                                            return await interaction.reply({ embeds: [VoiceEmbed], ephemeral: true });
                                        }
                                        
                                    }

                                    await VoiceLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true });

                                    const VoiceEmbed = new EmbedBuilder()
                                        .setColor(Colors.Blurple)
                                        .setDescription(`Voice Logs have been ${enabled ? 'enabled' : 'disabled'}`);

                                    await interaction.reply({ embeds: [VoiceEmbed], ephemeral: true });
                                    break;
                                case 'role':

                                    if(enabled) {
                                        const botPermissionsInRole = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
                                        const [hasRolePermissions, missingRolePermissions] = permissionCheck(channel, botPermissionsInRole, client);
    
                                        if (!hasRolePermissions) {
                                            const RoleEmbed = new EmbedBuilder()
                                                .setColor(Colors.Red)
                                                .setDescription(`Bot Missing Permissions: \`${missingRolePermissions}\` in ${channel}`);
                                            return await interaction.reply({ embeds: [RoleEmbed], ephemeral: true });
                                        }
                                    }

                                    await RoleLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true });

                                    const RoleEmbed = new EmbedBuilder()
                                        .setColor(Colors.Blurple)
                                        .setDescription(`Role Logs have been ${enabled ? 'enabled' : 'disabled'}`);

                                    await interaction.reply({ embeds: [RoleEmbed], ephemeral: true });
                                    break;
                                case 'server':

                                    if(enabled) {
                                        const botPermissionsInServer = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
                                        const [hasServerPermissions, missingServerPermissions] = permissionCheck(channel, botPermissionsInServer, client);
    
                                        if (!hasServerPermissions) {
                                            const ServerEmbed = new EmbedBuilder()
                                                .setColor(Colors.Red)
                                                .setDescription(`Bot Missing Permissions: \`${missingServerPermissions}\` in ${channel}`);
                                            return await interaction.reply({ embeds: [ServerEmbed], ephemeral: true });
                                        }
                                    }

                                    await ServerLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true });

                                    const ServerEmbed = new EmbedBuilder()
                                        .setColor(Colors.Blurple)
                                        .setDescription(`Server Logs have been ${enabled ? 'enabled' : 'disabled'}`);

                                    await interaction.reply({ embeds: [ServerEmbed], ephemeral: true });
                                    break;
                                case 'punishment':

                                    if(enabled) {
                                        const botPermissionsInPunishment = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
                                        const [hasPunishmentPermissions, missingPunishmentPermissions] = permissionCheck(channel, botPermissionsInPunishment, client);
    
                                        if (!hasPunishmentPermissions) {
                                            const PunishmentEmbed = new EmbedBuilder()
                                                .setColor(Colors.Red)
                                                .setDescription(`Bot Missing Permissions: \`${missingPunishmentPermissions}\` in ${channel}`);
                                            return await interaction.reply({ embeds: [PunishmentEmbed], ephemeral: true });
                                        }
                                    }

                                    await PunishmentLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true });

                                    const PunishmentEmbed = new EmbedBuilder()
                                        .setColor(Colors.Blurple)
                                        .setDescription(`Punishment Logs have been ${enabled ? 'enabled' : 'disabled'}`);

                                    await interaction.reply({ embeds: [PunishmentEmbed], ephemeral: true });
                                    break;
                                case 'joinleave':

                                    if(enabled) {
                                        const botPermissionsInJoinLeave = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
                                        const [hasJoinLeavePermissions, missingJoinLeavePermissions] = permissionCheck(channel, botPermissionsInJoinLeave, client);
    
                                        if (!hasJoinLeavePermissions) {
                                            const JoinLeaveEmbed = new EmbedBuilder()
                                                .setColor(Colors.Red)
                                                .setDescription(`Bot Missing Permissions: \`${missingJoinLeavePermissions}\` in ${channel}`);
                                            return await interaction.reply({ embeds: [JoinLeaveEmbed], ephemeral: true });
                                        }
                                    }

                                    await JoinLeaveLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true });

                                    const JoinLeaveEmbed = new EmbedBuilder()
                                        .setColor(Colors.Blurple)
                                        .setDescription(`Join/Leave Logs have been ${enabled ? 'enabled' : 'disabled'}`);

                                    await interaction.reply({ embeds: [JoinLeaveEmbed], ephemeral: true });

                                    break;
                                case 'all':

                                    if(enabled) {
                                        const botPermissionsInAll = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
                                        const [hasAllPermissions, missingAllPermissions] = permissionCheck(channel, botPermissionsInAll, client);
    
                                        if (!hasAllPermissions) {
                                            const AllEmbed = new EmbedBuilder()
                                                .setColor(Colors.Red)
                                                .setDescription(`Bot Missing Permissions: \`${missingAllPermissions}\` in ${channel}`);
                                            return await interaction.reply({ embeds: [AllEmbed], ephemeral: true });
                                        }
                                    }

                                    const updateLogs = [
                                        MessageLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true }),
                                        ChannelLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true }),
                                        VoiceLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true }),
                                        RoleLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true }),
                                        ServerLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true }),
                                        PunishmentLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true }),
                                        JoinLeaveLogs.findOneAndUpdate({ guildId: guild.id }, { channelId: channel?.id, enabled: enabled }, { upsert: true }),
                                    ];
                                    
                                    await Promise.all(updateLogs);

                                    const AllEmbed = new EmbedBuilder()
                                        .setColor(Colors.Blurple)
                                        .setDescription(`All Logs have been ${enabled ? 'enabled' : 'disabled'}`);

                                    await interaction.reply({ embeds: [AllEmbed], ephemeral: true });
                                    break;
                            }


                            break;
                        case 'reactionroles':

                            const reactionRolesType = options.getString('type');
                            const reactionRolesMessageId = options.getString('messageid');
                            const reactionRolesChannel = interaction.channel;

                            var reactionRolesMessage
                            if(reactionRolesMessageId) {
                                reactionRolesMessage = await reactionRolesChannel.messages.fetch(reactionRolesMessageId).catch(() => null);

                                if(!reactionRolesMessage) {
                                    const Embed = new EmbedBuilder()
                                        .setColor(Colors.Red)
                                        .setDescription('Message not found');
                                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                                }

                            }

                            const reactionRolesDataCheck = await ReactionRoles.find({ guildId: guild.id });

                            if(reactionRolesDataCheck.length > 0) {
                                await Promise.all(reactionRolesDataCheck.map(async reactionRole => {
                                    const channel = guild.channels.cache.get(reactionRole.channelId);
                                    if(!channel) {
                                        await ReactionRoles.findOneAndDelete({ channelId: reactionRole.channelId });
                                        return;
                                    }

                                    const message = await channel.messages.fetch(reactionRole.messageId).catch(() => null);
                                    if(!message) {
                                        await ReactionRoles.findOneAndDelete({ messageId: reactionRole.messageId });
                                        return;
                                    }
                                }));
                            }

                            switch (reactionRolesType) {
                                case 'add':
                                    await handleReactionRoleAdd(interaction, reactionRolesMessage);
                                break;
                                case 'remove':
                                    await handleReactionRoleRemove(interaction, reactionRolesMessage);
                                break;
                                case 'list':
                                    await handleReactionRoleList(interaction);               
                                break;
                            }

                            break;
                        case 'autoroles':

                            const autoRolesType = options.getString('type');
                            const autoRolesEnabled = options.getBoolean('enabled');
                            const autoRolesRole = options.getRole('role');

                            switch (autoRolesType) {
                                case 'add':
                                    await handleAutoRolesAdd(interaction, autoRolesRole, autoRolesEnabled);
                                    break;
                                case 'remove':
                                    await handleAutoRolesRemove(interaction, autoRolesRole, autoRolesEnabled);
                                    break;
                                case 'list':
                                    await handleAutoRolesList(interaction);
                                    break;
                            }


                            break;
                        case 'welcomemessages':
                            await handleWelcomeMessages(interaction);
                            break;
                        case 'leavemessages':
                            await handleLeaveMessages(interaction);
                            break;
                    }
                    break;
            }
        } catch (error) {
            console.log(error);
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('An error occurred while executing the setup command.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};

/**
 * @param {CommandInteraction} interaction
 */

async function handleLeaveMessages(interaction) {
    const { options, guild, client, user } = interaction;

    const leaveMessagesEnabled = options.getBoolean('enabled');
    const leaveMessagesChannel = options.getChannel('channel');
    const leaveMessagesMessage = options.getString('message');

    if(!leaveMessagesChannel && leaveMessagesEnabled) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a channel for welcome messages');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if(!leaveMessagesMessage && leaveMessagesEnabled) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a message for welcome messages');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if(leaveMessagesEnabled) {
        const botPermissionsInLeave = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasLeavePermissions, missingLeavePermissions] = permissionCheck(leaveMessagesChannel, botPermissionsInLeave, client);

        if (!hasLeavePermissions) {
            const LeaveEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`Bot Missing Permissions: \`${missingLeavePermissions}\` in ${leaveMessagesChannel}`);
            return await interaction.reply({ embeds: [LeaveEmbed], ephemeral: true });
        }
    }

    await LeaveMessage.findOneAndUpdate({ guildId: guild.id }, { channelId: leaveMessagesChannel?.id, enabled: leaveMessagesEnabled, message: leaveMessagesMessage }, { upsert: true });

    const LeaveEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`Leave Messages have been ${leaveMessagesEnabled ? 'enabled' : 'disabled'}`);

    await interaction.reply({ embeds: [LeaveEmbed], ephemeral: true });

    const previewEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(leaveMessagesMessage.replace(/{server}/g, guild.name).replace(/{username}/g, user.username).replace(/{usermention}/g, user).replace(/{memberCount}/g, guild.memberCount));

    await leaveMessagesChannel.send({ embeds: [previewEmbed] });
    
};

/**
 * @param {CommandInteraction} interaction
 */

async function handleWelcomeMessages(interaction) {
    const { options, guild, client, user } = interaction;

    const welcomeMessagesEnabled = options.getBoolean('enabled');
    const welcomeMessagesChannel = options.getChannel('channel');
    const welcomeMessagesMessage = options.getString('message');

    if(!welcomeMessagesChannel && welcomeMessagesEnabled) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a channel for welcome messages');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if(!welcomeMessagesMessage && welcomeMessagesEnabled) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a message for welcome messages');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if(welcomeMessagesEnabled) {
        const botPermissionsInWelcome = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasWelcomePermissions, missingWelcomePermissions] = permissionCheck(welcomeMessagesChannel, botPermissionsInWelcome, client);

        if (!hasWelcomePermissions) {
            const WelcomeEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`Bot Missing Permissions: \`${missingWelcomePermissions}\` in ${welcomeMessagesChannel}`);
            return await interaction.reply({ embeds: [WelcomeEmbed], ephemeral: true });
        }
    }

    await WelcomeMessage.findOneAndUpdate({ guildId: guild.id }, { channelId: welcomeMessagesChannel?.id, enabled: welcomeMessagesEnabled, message: welcomeMessagesMessage }, { upsert: true });

    const WelcomeEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`Welcome Messages have been ${welcomeMessagesEnabled ? 'enabled' : 'disabled'}`);

    await interaction.reply({ embeds: [WelcomeEmbed], ephemeral: true });

    const previewEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(welcomeMessagesMessage.replace(/{server}/g, guild.name).replace(/{username}/g, user.username).replace(/{usermention}/g, user).replace(/{memberCount}/g, guild.memberCount));

    await welcomeMessagesChannel.send({ embeds: [previewEmbed] });
    
};


/**
 * @param {CommandInteraction} interaction
 */

async function handleAutoRolesAdd(interaction, autoRolesRole, autoRolesEnabled) {
    const { guild } = interaction;
    

    if(!autoRolesRole) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a role for auto roles');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if(autoRolesRole.position >= guild.members.me.roles.highest.position) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Role is higher than the bot\'s role');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    let autoRolesData = await AutoRoles.findOne({ guildId: guild.id });

    if(!autoRolesData) {
        autoRolesData = new AutoRoles({
            guildId: guild.id,
            enabled: autoRolesEnabled,
            roles: [],
        });
    }

    if(autoRolesEnabled !== null && autoRolesData.enabled !== autoRolesEnabled) {
        autoRolesData.enabled = autoRolesEnabled;

        await autoRolesData.save();

        const EnableEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription(`Auto Roles have been ${autoRolesEnabled ? 'enabled' : 'disabled'}`);

        return await interaction.reply({ embeds: [EnableEmbed], ephemeral: true });
    }

    if(autoRolesData.roles.some(role => role === autoRolesRole.id)) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Role already exists in the auto roles');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    autoRolesData.roles.push(autoRolesRole.id);

    await autoRolesData.save();

    const AddEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`Role ${autoRolesRole} has been added to the auto roles`);

    await interaction.reply({ embeds: [AddEmbed], ephemeral: true });
};

/**
 * @param {CommandInteraction} interaction
 */

async function handleAutoRolesRemove(interaction, autoRolesRole, autoRolesEnabled) {
    const { guild } = interaction;

    if(!autoRolesRole) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a role for auto roles');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    let autoRolesDataRemove = await AutoRoles.findOne({ guildId: guild.id });

    if (!autoRolesDataRemove) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Auto Roles have not been enabled in this guild | To enable them a server admin can use \`/setup guild autoroles\`');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    console.log(autoRolesEnabled);

    if(autoRolesEnabled !== null && autoRolesDataRemove.enabled !== autoRolesEnabled) {
        autoRolesDataRemove.enabled = autoRolesEnabled;

        await autoRolesDataRemove.save();

        const EnableEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription(`Auto Roles have been ${autoRolesEnabled ? 'enabled' : 'disabled'}`);

        return await interaction.reply({ embeds: [EnableEmbed], ephemeral: true });
    }

    if (!autoRolesDataRemove.roles.some(role => role === autoRolesRole.id)) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Role not found in the auto roles');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    autoRolesDataRemove.roles = autoRolesDataRemove.roles.filter(role => role !== autoRolesRole.id);

    await autoRolesDataRemove.save();

    const RemoveEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`Role ${autoRolesRole} has been removed from the auto roles`);

    await interaction.reply({ embeds: [RemoveEmbed], ephemeral: true });
};

/**
 * @param {CommandInteraction} interaction
 */

async function handleAutoRolesList(interaction) {
    const { guild } = interaction;

    const autoRolesDataList = await AutoRoles.findOne({ guildId: guild.id });

    if(!autoRolesDataList) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('No auto roles found');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    const roles = autoRolesDataList.roles.map(role => guild.roles.cache.get(role));

    const ListEmbed = new EmbedBuilder()
        .setTitle('Auto Roles')
        .setColor(Colors.Blurple)
        .setDescription(`Auto Roles is ${autoRolesDataList.enabled}\n\n${roles.join('\n')}` || 'No auto roles set');

    await interaction.reply({ embeds: [ListEmbed] });
};


/**
 * @param {CommandInteraction} interaction
 */
async function handleReactionRoleAdd(interaction, reactionRolesMessage) {
    const { options, guild } = interaction;

    const reactionRolesRole = options.getRole('role');
    const reactionRolesEmoji = options.getString('emoji');
    const reactionRolesMessageId = options.getString('messageid');
    const reactionRolesTitle = options.getString('title');
    const reactionRolesChannel = interaction.channel;

    if(!reactionRolesRole) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a role for reaction roles');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if(!reactionRolesEmoji) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide an emoji for reaction roles');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if(!reactionRolesMessageId) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle(reactionRolesTitle || 'Reaction Roles')

        reactionRolesMessage = await reactionRolesChannel.send({ embeds: [Embed] })
        .catch(() => {return false})

        if(!reactionRolesMessage) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('I do not have permission to send messages in this channel');
            return interaction.reply({ embeds: [Embed], ephemeral: true });
        }

    }

    let reactionRolesData = await ReactionRoles.findOne({ guildId: guild.id, messageId: reactionRolesMessage.id });

    if(!reactionRolesData) {
        reactionRolesData = new ReactionRoles({
            guildId: guild.id,
            channelId: reactionRolesChannel.id,
            messageId: reactionRolesMessage.id,
            enabled: true,
            roles: [],
        });
    }

    if(reactionRolesData.roles.some(role => role.roleId === reactionRolesRole.id)) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Role already exists in the reaction roles');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    reactionRolesData.roles.push({ roleId: reactionRolesRole.id, roleEmoji: reactionRolesEmoji });

    await reactionRolesData.save();

    
    const roleMenu = new StringSelectMenuBuilder()
        .setCustomId(`select-role.${reactionRolesMessage.id}`)
        .setPlaceholder('Select a role')
        .setMaxValues(reactionRolesData.roles.length)
        .setMinValues(0)
        .addOptions(reactionRolesData.roles.map(role => {
            const emoji = parseEmoji(role.roleEmoji);
            return { label: guild.roles.cache.get(role.roleId).name, value: role.roleId, emoji: role.roleEmoji };
        }));

    const actionRow = new ActionRowBuilder().addComponents(roleMenu);

    await reactionRolesMessage.edit({ components: [actionRow] });
    
    const AddEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`Role ${reactionRolesRole} has been added to the reaction roles`);
    
    await interaction.reply({ embeds: [AddEmbed], ephemeral: true });
};

async function handleReactionRoleRemove(interaction, reactionRolesMessage) {
    const { options, guild } = interaction;

    const reactionRolesRole = options.getRole('role');
    const reactionRolesMessageId = options.getString('messageid');

    if(!reactionRolesRole) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a role for reaction roles');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if(!reactionRolesMessageId) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a message ID for the reaction roles');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    const reactionRolesDataRemove = await ReactionRoles.findOne({ messageId: reactionRolesMessageId });
    
    if (!reactionRolesDataRemove) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Invalid message id');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if (!reactionRolesDataRemove.roles.some(role => role.roleId === reactionRolesRole.id)) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Role not found in the reaction roles');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }


    reactionRolesDataRemove.roles = reactionRolesDataRemove.roles.filter(role => role.roleId !== reactionRolesRole.id);
    
    await reactionRolesDataRemove.save();

    if(reactionRolesDataRemove.roles.length === 0) {
        await ReactionRoles.findOneAndDelete({ messageId: reactionRolesMessageId });
        await reactionRolesMessage.delete();
        const Embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription('Reaction roles have been deleted');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }
    
    const roleMenu2 = new StringSelectMenuBuilder()
        .setCustomId(`select-role.${reactionRolesMessage.id}`)
        .setPlaceholder('Select a role')
        .setMaxValues(reactionRolesDataRemove.roles.length)
        .setMinValues(0)
        .addOptions(reactionRolesDataRemove.roles.map(role => {
            const emoji = parseEmoji(role.roleEmoji);
            return { label: guild.roles.cache.get(role.roleId).name, value: role.roleId, emoji: role.roleEmoji };
        }));
    
    const actionRow2 = new ActionRowBuilder().addComponents(roleMenu2);
    
    await reactionRolesMessage.edit({ components: [actionRow2] });
    
    const RemoveEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`Role ${reactionRolesRole} has been removed from the reaction roles`);
    
    await interaction.reply({ embeds: [RemoveEmbed], ephemeral: true });
};

async function handleReactionRoleList(interaction) {
    const { guild } = interaction;

    const reactionRolesDataList = await ReactionRoles.find({ guildId: guild.id });

    if(reactionRolesDataList.length === 0) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('No reaction roles found');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    const reactionRolesList = await Promise.all(reactionRolesDataList.map(async reactionRole => {
        const channel = guild.channels.cache.get(reactionRole.channelId);
        if(!channel) {
            await ReactionRoles.findOneAndDelete({ channelId: reactionRole.channelId });
            return;
        }

        const message = await channel.messages.fetch(reactionRole.messageId).catch(() => null);
        if(!message) {
            await ReactionRoles.findOneAndDelete({ messageId: reactionRole.messageId });
            return;
        }

        const roles = reactionRole.roles.map(role => {
            const emoji = parseEmoji(role.roleEmoji);
            return `${guild.roles.cache.get(role.roleId)} | ${emoji ? role.roleEmoji : ''}`;
        });

        return `${channel} | ${message.embeds[0].title}\n${roles.join('\n')}`;
    }));

    const ListEmbed = new EmbedBuilder()
        .setTitle('Reaction Roles')
        .setColor(Colors.Blurple)
        .setDescription(reactionRolesList.join('\n\n') || 'No reaction roles set');

    await interaction.reply({ embeds: [ListEmbed] });
};


async function handleLevelBlacklist(interaction) {
    const { options, guild } = interaction;
    const type = options.getString('type');
    const role = options.getRole('role');
    const channel = options.getChannel('channel');

    let LevelBlacklistData = await LevelNotifications.findOne({ guildId: guild.id });

    if (!LevelBlacklistData) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Level Notifications have not been enabled in this guild | To enable them a server admin can use `/setup guild levelnotifications`');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    switch (type) {
        case 'add':
            if (!role && !channel) {
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('Please provide a role or channel for the blacklist');
                return await interaction.reply({ embeds: [Embed], ephemeral: true });
            }

            if (role) {
                if (LevelBlacklistData.blacklisted.roles.includes(role.id)) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('Role already exists in the blacklist');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                LevelBlacklistData.blacklisted.roles.push(role.id);

                const AddEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription(`Role ${role} has been added to the blacklist`);
                await interaction.reply({ embeds: [AddEmbed], ephemeral: true });
            }

            if (channel) {
                if (LevelBlacklistData.blacklisted.channels.includes(channel.id)) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('Channel already exists in the blacklist');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                LevelBlacklistData.blacklisted.channels.push(channel.id);

                const AddEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription(`Channel ${channel} has been added to the blacklist`);
                await interaction.reply({ embeds: [AddEmbed], ephemeral: true });
            }

            await LevelBlacklistData.save();
            break;

        case 'remove':
            if (!role && !channel) {
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('Please provide a role or channel for the blacklist');
                return await interaction.reply({ embeds: [Embed], ephemeral: true });
            }

            if (role) {
                if (!LevelBlacklistData.blacklisted.roles.includes(role.id)) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('Role does not exist in the blacklist');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                LevelBlacklistData.blacklisted.roles = LevelBlacklistData.blacklisted.roles.filter(roleId => roleId !== role.id);

                const RemoveEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription(`Role ${role} has been removed from the blacklist`);
                await interaction.reply({ embeds: [RemoveEmbed], ephemeral: true });
            }

            if (channel) {
                if (!LevelBlacklistData.blacklisted.channels.includes(channel.id)) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('Channel does not exist in the blacklist');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                LevelBlacklistData.blacklisted.channels = LevelBlacklistData.blacklisted.channels.filter(channelId => channelId !== channel.id);

                const RemoveEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription(`Channel ${channel} has been removed from the blacklist`);
                await interaction.reply({ embeds: [RemoveEmbed], ephemeral: true });
            }

            await LevelBlacklistData.save();
            break;

        case 'list':
            if (!LevelBlacklistData) {
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('Level Notifications have not been enabled in this guild | To enable them a server admin can use `/setup guild levelnotifications`');
                return await interaction.reply({ embeds: [Embed], ephemeral: true });
            }

            const roles = LevelBlacklistData.blacklisted.roles.map(roleId => guild.roles.cache.get(roleId)).filter(role => role);
            const channels = LevelBlacklistData.blacklisted.channels.map(channelId => guild.channels.cache.get(channelId)).filter(channel => channel);

            if (roles.length === 0 && channels.length === 0) {
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('No blacklist roles/channels set');
                return await interaction.reply({ embeds: [Embed], ephemeral: true });
            }

            const ListEmbed = new EmbedBuilder()
                .setTitle('Level Blacklist')
                .setColor(Colors.Blurple)
                .setDescription(`Roles: ${roles.join(', ')}\n\nChannels: ${channels.join(', ')}` || 'No blacklist set');

            await interaction.reply({ embeds: [ListEmbed] });
            break;
    }
}

/**
 * @param {CommandInteraction} interaction
 */
async function handleLevelRewards(interaction) {
    const { options, guild } = interaction;
    const type = options.getString('type');
    const role = options.getRole('role');
    const level = options.getInteger('level');

    if(role) {
        if (level < 1) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('Level must be greater than 0');
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }
    }

    let LevelData = await LevelNotifications.findOne({ guildId: guild.id });

    if (!LevelData) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Levels are not enabled on this server, `/setup guild levels` to enable levels');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    switch (type) {
        case 'add':

            if(!role) {
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('Please provide a role for level rewards');
                return await interaction.reply({ embeds: [Embed], ephemeral: true });
            }
            
            if(LevelData.levelRewards.some(reward => reward.roleId === role.id)) {
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('Role already exists in the level rewards');
                return await interaction.reply({ embeds: [Embed], ephemeral: true });
            }

            if(LevelData.levelRewards.some(reward => reward.level === level)) {
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('Level already has a role assigned');
                return await interaction.reply({ embeds: [Embed], ephemeral: true });
            }

            LevelData.levelRewards.push({ roleId: role.id, level: level });

            const AddEmbed = new EmbedBuilder()
                .setColor(Colors.Blurple)
                .setDescription(`Role ${role} has been added to level ${level}`);
            await interaction.reply({ embeds: [AddEmbed], ephemeral: true });

            await LevelData.save();
            
            break;
        case 'remove':

            if(!role) {
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('Please provide a role for level rewards');
                return await interaction.reply({ embeds: [Embed], ephemeral: true });
            }

            if(!LevelData.levelRewards.some(reward => reward.roleId === role.id)) {

                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('Role does not exist in the level rewards');
                return await interaction.reply({ embeds: [Embed], ephemeral: true });
            }

            const RemoveEmbed = new EmbedBuilder()
                .setColor(Colors.Blurple)
                .setDescription(`Role ${role} has been removed from level ${level}`);
            await interaction.reply({ embeds: [RemoveEmbed], ephemeral: true });


            LevelData.levelRewards.pull({ roleId: role.id });

            await LevelData.save();

            break;
        case 'list':

            const rewards = LevelData.levelRewards.map(reward => {
                const role = guild.roles.cache.get(reward.roleId);

                if(!role) {
                    LevelData.levelRewards.pull({ roleId: reward.roleId });

                    LevelData.save();
                    return
                }
                return `Level ${reward.level}: ${role ? role.toString() : 'Role not found'}`;
            });            

            const ListEmbed = new EmbedBuilder()
                .setTitle('Level Rewards')
                .setColor(Colors.Blurple)
                .setDescription(rewards.join('\n') || 'No rewards set');

            await interaction.reply({ embeds: [ListEmbed] });
            break;
    }


}
/**
 * @param {CommandInteraction} interaction
 */
async function handleInviteDetection(interaction) {
    const { options, guild } = interaction;
    const enabled = options.getBoolean('enabled');

    let InviteDetectionData = await InviteDetection.findOne({ guildId: guild.id });

    if (!InviteDetectionData) {
        InviteDetectionData = new InviteDetection({
            guildId: guild.id,
            enabled: enabled,
        });
    }

    InviteDetectionData.enabled = enabled;
    await InviteDetectionData.save();

    const InviteDetectionEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`Invite Detection has been ${enabled ? 'enabled' : 'disabled'}`);

    await interaction.reply({ embeds: [InviteDetectionEmbed], ephemeral: true });
}

/**
 * @param {CommandInteraction} interaction
 */

async function handleLevels(interaction) {
    const { options, guild } = interaction;
    const levelEnabled = options.getBoolean('enabled');
    const levelChannel = options.getChannel('channel');

    if (levelEnabled && !levelChannel) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a channel for level up messages');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    let LevelData = await LevelNotifications.findOne({ guildId: guild.id });

    if (!LevelData) {
        LevelData = new LevelNotifications({
            guildId: guild.id,
            channelId: levelChannel ? levelChannel.id : null,
            enabled: levelEnabled,
        });
    }

    LevelData.enabled = levelEnabled;
    LevelData.channelId = levelChannel ? levelChannel.id : null;
    await LevelData.save();

    const LevelSetupEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`Level System has been ${levelEnabled ? 'enabled' : 'disabled'}`);

    await interaction.reply({ embeds: [LevelSetupEmbed], ephemeral: true });
}

/**
 * @param {CommandInteraction} interaction
 */
async function handleTickets(interaction) {
    const { options, guild, client } = interaction;

    const enabled = options.getBoolean('enabled');
    const setupChannel = options.getChannel('setup-channel');
    const ticketCategory = options.getChannel('ticket-category');
    const archiveChannel = options.getChannel('archive-channel');
    const supportRole = options.getRole('support-role');
    const adminRole = options.getRole('admin-role');
                    
    if (!enabled) {
    
        let TicketData = await Tickets.findOne({ guildId: guild.id });
    
        if (!TicketData) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('Tickets are not setup on this server, `/setup guild tickets` to enable tickets');
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }
    
        TicketData.enabled = false;
    
        await TicketData.save();
    
        const Embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription('Tickets have been disabled');
    
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }
    

    if (!setupChannel) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a channel for ticket setup');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if (!ticketCategory) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a category for tickets');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if (!archiveChannel) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a channel for ticket archives');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if (!supportRole) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a support role');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if (!adminRole) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide an admin role');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    const botPermissionsInSetUp = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels];
    const [hasSetupPermissions, missingSetupPermissions] = permissionCheck(setupChannel, botPermissionsInSetUp, client);

    if (!hasSetupPermissions) {
        const SetupEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription(`Bot Missing Permissions: \`${missingSetupPermissions}\` in ${setupChannel}`);
        return await interaction.reply({ embeds: [SetupEmbed], ephemeral: true });
    }

    const botPermissionsInArchive = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
    const [hasArchivePermissions, missingArchivePermissions] = permissionCheck(archiveChannel, botPermissionsInArchive, client);

    if (!hasArchivePermissions) {
        const ArchiveEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription(`Bot Missing Permissions: \`${missingArchivePermissions}\` in ${archiveChannel}`);
        return await interaction.reply({ embeds: [ArchiveEmbed], ephemeral: true });
    }

    const botPermissionsInCategory = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles];
    const [hasCategoryPermissions, missingCategoryPermissions] = permissionCheck(ticketCategory, botPermissionsInCategory, client);

    if (!hasCategoryPermissions) {
        const CategoryEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription(`Bot Missing Permissions: \`${missingCategoryPermissions}\` in ${ticketCategory}`);
        return await interaction.reply({ embeds: [CategoryEmbed], ephemeral: true });
    }

    if(supportRole.position >= guild.members.me.roles.highest.position || adminRole.position >= guild.members.me.roles.highest.position) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Roles are higher than the bot\'s role');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

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

    await Tickets.findOneAndUpdate({ guildId: guild.id }, {
        enabled: enabled,
        setupChannelId: setupChannel.id,
        ticketCategoryId: ticketCategory.id,
        archiveChannelId: archiveChannel.id,
        supportRoleId: supportRole.id,
        adminRoleId: adminRole.id,
    }, { upsert: true });

    const ticketsSuccess = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription('Tickets have been setup successfully');

    await interaction.reply({ embeds: [ticketsSuccess], ephemeral: true });

}