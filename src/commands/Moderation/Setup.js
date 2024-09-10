const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, PermissionFlagsBits, InteractionContextType, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { InviteDetection, LevelNotifications, ChannelLogs, MessageLogs, VoiceLogs, RoleLogs, ServerLogs, PunishmentLogs, JoinLeaveLogs } = require('../../models/GuildSetups.js');
const { permissionCheck } = require('../../utils/Checks.js');
const { Tickets } = require('../../models/GuildSetups.js');

module.exports = {
    cooldown: 5,
    category: 'Moderation',
    userpermissions: [PermissionFlagsBits.ManageGuild],
    botpermissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageRoles],
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup the bot for your server.')
        .setContexts(InteractionContextType.Guild)
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

                                    // how would you handle multiple logs?
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
                .setColor(Colors.Green)
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
                .setColor(Colors.Green)
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
                .setDescription(rewards.join('\n'));

            await interaction.reply({ embeds: [ListEmbed], ephemeral: true });
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
        // Disable tickets
    
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