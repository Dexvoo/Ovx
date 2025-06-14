const { SlashCommandBuilder, Colors, CommandInteraction, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, EmbedBuilder, AutocompleteInteraction, GuildMember, Client, User, MessageFlags } = require('discord.js');
const { SendEmbed, consoleLogData, ShortTimestamp } = require('../../utils/LoggingData')
require('dotenv').config();
const ms = require('ms');
const { DeveloperIDs } = process.env;
const LogsCache = require('../../cache/Logs');
const { permissionCheck } = require('../../utils/Permissions');

module.exports = {
    cooldown: 0,
    category: 'Moderation',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('moderation')
        .setDescription('Ban, unban, kick, mute, unmute, purge messages, or change the nickname of a user')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers | PermissionFlagsBits.ModerateMembers)
        
        .addSubcommand(subcommand => subcommand
            .setName('ban')
            .setDescription('Ban a user')
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user to ban')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('reason')
                .setDescription('The reason for the ban')
                .setRequired(false)
            )
            .addBooleanOption(option => option
                .setName('preserve_messages')
                .setDescription('Preserve messages from the user')
                .setRequired(false)
            )
        )
        
        .addSubcommand(subcommand => subcommand
            .setName('unban')
            .setDescription('Unban a user')
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user to unban')
                .setRequired(true)
            )
        )

        .addSubcommand(subcommand => subcommand
            .setName('kick')
            .setDescription('Kick a user')
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user to kick')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('reason')
                .setDescription('The reason for the kick')
                .setRequired(false)
            )
        )


        .addSubcommand(subcommand => subcommand
            .setName('mute')
            .setDescription('Timeout a user')
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user to timeout')
                .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName('duration')
                    .setDescription('How long do you want to timeout this user for? e.g. "10m, 1d, 1w"')
                    .setRequired(true)
            )
            .addStringOption(option => option
                .setName('reason')
                .setDescription('The reason for the timeout')
                .setRequired(false)
            )
        )

        .addSubcommand(subcommand => subcommand
            .setName('unmute')
            .setDescription('Remove a mute from a user')
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user to remove a mute')
                .setRequired(true)
            )
        )
        
        .addSubcommand(subcommand => subcommand
            .setName('purge')
            .setDescription('Remove a specific amount of messages')
            .addIntegerOption(option => option
                .setName('amount')
                .setDescription('The amount of messages to purge')
                .setMaxValue(100)
				.setMinValue(1)
                .setRequired(true)
            )
        )

        .addSubcommand(subcommand => subcommand
            .setName('nickname')
            .setDescription('Change the nickname of a user')
            .addUserOption(option => option
                .setName('user-id')
                .setDescription('The user to change the nickname of')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('nickname')
                .setDescription('The new nickname')
                .setRequired(false)
            )
        )

        ,
    /**
    * @param {CommandInteraction} interaction
    */

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral]});

        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case 'ban':
                await BanUser(interaction);
                break;
            case 'unban':
                await UnbanUser(interaction);
                break;
            case 'kick':
                await KickUser(interaction);
                break;
            case 'mute':
                await MuteUser(interaction);
                break;
            case 'unmute':
                await UnmuteUser(interaction);
                break;
            case 'purge':
                await PurgeMessages(interaction);
                break;
            case 'nickname':
                await NicknameUser(interaction);
                break;
            default: 
                consoleLogData('Moderation Command', `Unknown subcommand`, `error`)
                SendEmbed(interaction, Colors.Red, 'Failed Command', 'Unknown subcommand')
            break;
        };

    }
};

/**
* @param {CommandInteraction} interaction
*/
async function BanUser(interaction) {
    const { options, guild, client, member } = interaction;

    const targetUser = options.getUser('user');
    const targetMember = options.getMember('user');
    const reason = options.getString('reason') || 'No reason provided';
    const preserveMessages = options.getBoolean('preserve_messages') || false;
    const botMember = guild.members.me;

    // Permissions
    if(!member.permissions.has(PermissionFlagsBits.BanMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Ban', `User Missing Permissions | \`BanMembers\``);
    if(!botMember.permissions.has(PermissionFlagsBits.BanMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Ban', `Bot Missing Permissions | \`BanMembers\``);

    
    // Checks
    if(targetUser.id === client.user.id) return SendEmbed(interaction, Colors.Red, 'Failed Ban', 'I can\'t ban myself');
    if(targetUser.id === member.id) return SendEmbed(interaction, Colors.Red, 'Failed Ban', 'You can\'t ban yourself');
    if(targetMember) {
        if (!targetMember.bannable) return SendEmbed(interaction, Colors.Red, 'Failed Ban', `Bot Missing Permissions | \`RoleHierarchy\``);
        if(member.roles.highest.position <= targetMember.roles.highest.position) return SendEmbed(interaction, Colors.Red, 'Failed Ban', `You can\'t ban a member with a higher role than you`);
    };

    // Get Ban
    const isBanned = await guild.bans.fetch(targetUser.id).catch(() => null);
    if (isBanned) return SendEmbed(interaction, Colors.Red, 'Failed Ban', `User already banned`);

    // If user is in the discord, DM them
    if(targetMember){
        const DMEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription(`You have been banned from **${guild.name}**`)
            .addFields(
                { name: 'Reason', value: reason },
                { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
            );

        try {
            await targetMember.send({embeds: [DMEmbed]});
        } catch (error) {
            const FailedDMEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('DM Failed')
                .setDescription(`Could not DM user`)
            interaction.followUp({ embeds: [FailedDMEmbed], flags: [MessageFlags.Ephemeral] });
        };
    };


    // Ban user
    try {
        await guild.bans.create(targetUser.id, { reason: `Banned by @${member.user.username} for: ${reason}`, deleteMessageSeconds: preserveMessages ? 0 : 7 });
    } catch (error) {
        return SendEmbed(interaction, Colors.Red, 'Failed Ban', `Bot Missing Permissions | \`Unknown\``);
    };

    SendEmbed(interaction, Colors.Blurple, 'Ban Successful', `You banned ${targetUser} from the server`, [
        { name: 'Reason', value: reason },
        { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
    ]);

};




/**
* @param {CommandInteraction} interaction
*/
async function UnbanUser(interaction) {
    const { options, guild, client, member } = interaction;

    const targetUser = options.getUser('user');
    const botMember = guild.members.me;

    // Permissions
    if(!member.permissions.has(PermissionFlagsBits.BanMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Unban', `User Missing Permissions | \`BanMembers\``, []);
    if(!botMember.permissions.has(PermissionFlagsBits.BanMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Unban', `Bot Missing Permissions | \`BanMembers\``, []);

    // Get Ban
    const isBanned = await guild.bans.fetch(targetUser.id).catch(() => null);
    if (!isBanned) return SendEmbed(interaction, Colors.Red, 'Failed Unban', `User is not banned`, []);

    // Unban user
    try {
        await guild.bans.remove(targetUser.id, `Unbanned by @${member.user.username}`);
    } catch (error) {
        return SendEmbed(interaction, Colors.Red, 'Failed Unban', `Bot Missing Permissions | \`${error}\``, []);
    };

    // If user is in a common discord server with bot, DM them
    await client.users.fetch(targetUser.id)
    .then(user => { 
        const DMEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription(`You have been unbanned from **${guild.name}**`)
            .addFields(
                { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
            );

        return user.send({ embeds: [DMEmbed]});
    })
    .catch(error => {
        const FailedDMEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('DM Failed')
            .setDescription(`Could not DM user`)
        interaction.followUp({ embeds: [FailedDMEmbed], flags: [MessageFlags.Ephemeral] });
    })

    SendEmbed(interaction, Colors.Blurple, 'Unban Successful', `Unbanned ${targetUser} from the server`, [
        { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
    ]);

};


/**
* @param {CommandInteraction} interaction
*/
async function KickUser(interaction) {
    const { options, guild, client, member } = interaction;

    const targetUser = options.getUser('user');
    const targetMember = options.getMember('user');
    const reason = options.getString('reason') || 'No reason provided';
    const botMember = guild.members.me;

    if(!targetMember) return SendEmbed(interaction, Colors.Red, 'Failed Kick', `User is not in the server`, []);

    // Permissions
    if(!member.permissions.has(PermissionFlagsBits.KickMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Kick', `User Missing Permissions | \`KickMembers\``, []);
    if(!botMember.permissions.has(PermissionFlagsBits.KickMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Kick', `Bot Missing Permissions | \`KickMembers\``, []);

    
    // Checks
    if(targetUser.id === client.user.id) return SendEmbed(interaction, Colors.Red, 'Failed Kick', 'I can\'t kick myself', []);
    if(targetUser.id === member.id) return SendEmbed(interaction, Colors.Red, 'Failed Kick', 'You can\'t kick yourself', []);
    if(!targetMember.kickable) return SendEmbed(interaction, Colors.Red, 'Failed Kick', `Bot Missing Permissions | \`RoleHierarchy\``, []);
    if(member.roles.highest.position <= targetMember.roles.highest.position) return SendEmbed(interaction, Colors.Red, 'Failed Kick', `You can\'t kick a member with a higher role than you`, []);

    
    // If user is in the discord, DM them
    const DMEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`You have been kicked from **${guild.name}**`)
        .addFields(
            { name: 'Reason', value: reason },
            { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
        );
        
    try {
        await targetMember.send({embeds: [DMEmbed]});
    } catch (error) {
        const FailedDMEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('DM Failed')
            .setDescription(`Could not DM user`)
        interaction.followUp({ embeds: [FailedDMEmbed], flags: [MessageFlags.Ephemeral] });
    };
    
    // Kick user
    try {
        await targetMember.kick({ reason: `Kicked by @${member.user.username} for: ${reason}` })
    } catch (error) {
        return SendEmbed(interaction, Colors.Red, 'Failed Kick', `Could not kick user : ${error}`);
    }

    SendEmbed(interaction, Colors.Blurple, 'Kick Successful', `You Kicked ${targetUser} from the server`, [
        { name: 'Reason', value: reason },
        { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
    ]);

    const LogsData = await LogsCache.get(guild.id);
    if(!LogsData) return consoleLogData('Punishment Kick', `Guild: ${guild.name} | Disabled`, 'warning');

    const joinLogData = LogsData.punishment
    if(!joinLogData || !joinLogData.enabled || joinLogData.channelId === null) return consoleLogData('Punishment Kick', `Guild: ${guild.name} | Disabled`, 'warning');

    const logChannel = guild.channels.cache.get(joinLogData.channelId);
    if(!logChannel) {
        await LogsCache.setType(guild.id, 'punishment', { enabled: false, channelId: null });
        return consoleLogData('Punishment Kick', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
    }

    const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
    const [hasPermission, missingPermissions] = permissionCheck(logChannel, botPermissions, client);
    if(!hasPermission) {
        await LogsCache.setType(guild.id, 'punishment', { enabled: false, channelId: null });
        return consoleLogData('Punishment Kick', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
    }

    const description = [
        `User: ${targetUser}`,
        `Reason: ${reason || 'No reason provided'}`,
    ];

    const LogEmbed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL({ size: 512, extension: 'png' }) })
        .setTitle(`${targetUser.bot ? 'Bot' : 'User'} Kicked`)
        .setDescription(description.join('\n'))
        .setFooter({ text: `UID: ${targetUser.id}` })
        .setTimestamp();

    logChannel.send({ embeds: [LogEmbed] })
        .then(() => consoleLogData('Punishment Kick', `Guild: ${guild.name} | ${targetUser.bot ? '🤖 Bot' : '👤 User'} @${targetUser.username}`, 'info'))
        .catch(err => consoleLogData('Punishment Kick', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
};


/**
* @param {CommandInteraction} interaction
*/
async function MuteUser(interaction) {
    const { options, guild, client, member } = interaction;

    const targetUser = options.getUser('user');
    const targetMember = options.getMember('user');
    const duration = ms(options.getString('duration'));
    const reason = options.getString('reason') || 'No reason provided';
    const botMember = guild.members.me;

    if(!targetMember) return SendEmbed(interaction, Colors.Red, 'Failed Mute', `User is not in the server`, []);

    // Permissions
    if(!member.permissions.has(PermissionFlagsBits.ModerateMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Mute', `User Missing Permissions | \`ModerateMembers\``, []);
    if(!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Mute', `Bot Missing Permissions | \`ModerateMembers\``, []);

    
    // Checks
    if(targetUser.id === client.user.id) return SendEmbed(interaction, Colors.Red, 'Failed Mute', 'I can\'t mute myself', []);
    if(targetUser.id === member.id) return SendEmbed(interaction, Colors.Red, 'Failed Mute', 'You can\'t mute yourself', []);
    if(targetMember.isCommunicationDisabled()) return SendEmbed(interaction, Colors.Red, 'Failed Mute', `${targetMember} is already muted, It ends ${ShortTimestamp(targetMember.communicationDisabledUntil)}`, []);
    if(!targetMember.moderatable) return SendEmbed(interaction, Colors.Red, 'Failed Mute', `Bot Missing Permissions | \`RoleHierarchy\``, []);
    if(member.roles.highest.position <= targetMember.roles.highest.position) return SendEmbed(interaction, Colors.Red, 'Failed Mute', `You can\'t mute a member with a higher role than you`, []);
    if(!duration) return SendEmbed(interaction, Colors.Red, 'Failed Mute', `Please provide a valid duration of time e.g. 10m, 1h, 1d`, []);
    if(duration > 28 * 24 * 60 * 60 * 1000) return SendEmbed(interaction, Colors.Red, 'Failed Mute', `You can't mute a user for longer than 28 days`, []);

    
    // If user is in the discord, DM them
    const DMEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`You have been muted in **${guild.name}**`)
        .addFields(
            { name: 'Reason', value: reason, inline: false },
            { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true },
            { name: 'Duration', value: ms(duration, { long: true }), inline: true }
        );
        
    try {
        await targetMember.send({embeds: [DMEmbed]});
    } catch (error) {
        const FailedDMEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('DM Failed')
            .setDescription(`Could not DM user`)
        interaction.followUp({ embeds: [FailedDMEmbed], flags: [MessageFlags.Ephemeral] });
    };
    
    // Mute user
    try {
        await targetMember.disableCommunicationUntil(Date.now() + duration, `Muted by @${member.user.username} for: ${reason}`);
    } catch (error) {
        return SendEmbed(interaction, Colors.Red, 'Failed Mute', `Could not mute user : ${error}`);
    }

    SendEmbed(interaction, Colors.Blurple, 'Mute Successful', `You muted ${targetUser}`, [
        { name: 'Reason', value: reason, inline: false },
        { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true },
        { name: 'Duration', value: ms(duration, { long: true }), inline: true }
    ]);
};


/**
* @param {CommandInteraction} interaction
*/
async function UnmuteUser(interaction) {
    const { options, guild, client, member } = interaction;

    const targetUser = options.getUser('user');
    const targetMember = options.getMember('user');
    const botMember = guild.members.me;

    if(!targetMember) return SendEmbed(interaction, Colors.Red, 'Failed Unmute', `User is not in the server`, []);

    // Permissions
    if(!member.permissions.has(PermissionFlagsBits.ModerateMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Unmute', `User Missing Permissions | \`ModerateMembers\``, []);
    if(!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) return SendEmbed(interaction, Colors.Red, 'Failed Unmute', `Bot Missing Permissions | \`ModerateMembers\``, []);

    
    // Checks
    if(targetUser.id === client.user.id) return SendEmbed(interaction, Colors.Red, 'Failed Unmute', 'I can\'t unmute myself', []);
    if(targetUser.id === member.id) return SendEmbed(interaction, Colors.Red, 'Failed Unmute', 'You can\'t mute yourself', []);
    if(!targetMember.isCommunicationDisabled()) return SendEmbed(interaction, Colors.Red, 'Failed Unmute', `${targetMember} is not muted`, []);
    if(!targetMember.moderatable) return SendEmbed(interaction, Colors.Red, 'Failed Unmute', `Bot Missing Permissions | \`RoleHierarchy\``, []);
    if(member.roles.highest.position <= targetMember.roles.highest.position) return SendEmbed(interaction, Colors.Red, 'Failed Unmute', `You can\'t unmute a member with a higher role than you`, []);

    
    // If user is in the discord, DM them
    const DMEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`You have been unmuted in **${guild.name}**`)
        .addFields(
            { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
        );
        
    try {
        await targetMember.send({embeds: [DMEmbed]});
    } catch (error) {
        const FailedDMEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('DM Failed')
            .setDescription(`Could not DM user`)
        interaction.followUp({ embeds: [FailedDMEmbed], flags: [MessageFlags.Ephemeral] });
    };
    
    // Unmute user
    try {
        await targetMember.disableCommunicationUntil(null);
    } catch (error) {
        return SendEmbed(interaction, Colors.Red, 'Failed Unmute', `Could not unmute user : ${error}`);
    }

    SendEmbed(interaction, Colors.Blurple, 'Unmute Successful', `You unmuted ${targetUser}`, [
        { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
    ]);
};

/**
* @param {CommandInteraction} interaction
*/
async function PurgeMessages(interaction) {
    const { options, guild, client, member, channel } = interaction;

    const botMember = guild.members.me;
    const amount = options.getInteger('amount');

    // Permissions
    if(!member.permissions.has(PermissionFlagsBits.ManageGuild)) return SendEmbed(interaction, Colors.Red, 'Failed Purge', `User Missing Permissions | \`ManageGuild\``, []);
    if(!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) return SendEmbed(interaction, Colors.Red, 'Failed Purge', `Bot Missing Permissions | \`ManageMessages\``, []);
    
    // Purge Messages
    let deletedMessages;
    try {
        deletedMessages = await channel.bulkDelete(amount, true);

    } catch (error) {
        return SendEmbed(interaction, Colors.Red, 'Failed Purge', `Could not unmute user : ${error}`);
    }

    if(deletedMessages.size === 0) return SendEmbed(interaction, Colors.Red, 'Failed Purge', `You purged ${deletedMessages.size} messages\n\n-# ℹ️ : Bots can only delete messages that are up to 2 weeks old`, []);
    SendEmbed(interaction, Colors.Blurple, 'Successful Purge', `You purged ${deletedMessages.size} messages`, [
            { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: true }
    ]);
};


/**
* @param {CommandInteraction} interaction
*/
async function NicknameUser(interaction) {
    const { options, guild, client, member, channel } = interaction;

    const botMember = guild.members.me;
    const newNickname = options.getString('nickname');
    const targetMember = options.getMember('user-id');

    // Permissions
    if(!member.permissions.has(PermissionFlagsBits.ManageGuild)) return SendEmbed(interaction, Colors.Red, 'Failed Purge', `User Missing Permissions | \`ManageGuild\``, []);
    if(!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) return SendEmbed(interaction, Colors.Red, 'Failed Purge', `Bot Missing Permissions | \`ManageMessages\``, []);
    
    
    if(!targetMember) return SendEmbed(interaction, Colors.Red, 'Failed Nickname', `User is not in the server`, []);
    const oldNickname = targetMember.nickname || targetMember.user.username;

    // Checks
    if(targetMember.id === client.user.id) return SendEmbed(interaction, Colors.Red, 'Failed Nickname', 'I can\'t change my own nickname', []);
    if(targetMember.id === member.id) return SendEmbed(interaction, Colors.Red, 'Failed Nickname', 'You can\'t change your own nickname', []);
    if(!targetMember.moderatable) return SendEmbed(interaction, Colors.Red, 'Failed Nickname', `Bot Missing Permissions | \`RoleHierarchy\``, []);
    if(member.roles.highest.position <= targetMember.roles.highest.position) return SendEmbed(interaction, Colors.Red, 'Failed Nickname', `You can\'t change the nickname of a member with a higher role than you`, []);
    
    if(!newNickname) {
        await targetMember.setNickname('', `Changed by @${interaction.user.tag}`).catch(console.error);

        SendEmbed(interaction, Colors.Blurple, 'Nickname Changed', `You removed the nickname of ${targetMember}`, [
            { name: 'Old Nickname', value: oldNickname, inline: true },
            { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: false }
        ]);

        const DMEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription(`Your nickname has been removed in **${guild.name}**`)
            .addFields(
                { name: 'Old Nickname', value: oldNickname, inline: true },
                { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: false }
            );

        try {
            await targetMember.send({embeds: [DMEmbed]});
        }
        catch (error) {
            const FailedDMEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('DM Failed')
                .setDescription(`Could not DM user`)
            interaction.followUp({ embeds: [FailedDMEmbed], flags: [MessageFlags.Ephemeral] });
        };

        return;
    }

    if(newNickname.length > 32) return SendEmbed(interaction, Colors.Red, 'Failed Nickname', `New nickname is too long`, []);
    if(newNickname === oldNickname) return SendEmbed(interaction, Colors.Red, 'Failed Nickname', `New nickname is the same as the old nickname`, []);
    
    await targetMember.setNickname(newNickname, `Changed by @${interaction.user.username}`).catch(console.error);

    await SendEmbed(interaction, Colors.Blurple, 'Nickname Changed', `You changed the nickname of ${targetMember}`, [
        { name: 'Old Nickname', value: oldNickname, inline: true },
        { name: 'New Nickname', value: newNickname, inline: true },
        { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: false }
    ]);


    const DMEmbed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setDescription(`Your nickname has been changed in **${guild.name}**`)
        .addFields(
            { name: 'Old Nickname', value: oldNickname, inline: true },
            { name: 'New Nickname', value: newNickname, inline: true },
            { name: 'Moderator', value: `@${member.user.username} | (${member})`, inline: false }
        );

    try {
        await targetMember.send({embeds: [DMEmbed]});
    } catch (error) {
        const FailedDMEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('DM Failed')
            .setDescription(`Could not DM user`)
        interaction.followUp({ embeds: [FailedDMEmbed], flags: [MessageFlags.Ephemeral] });
    }


};