const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, PermissionFlagsBits, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

module.exports = {
    cooldown: 5,
    category: 'Moderation',
    userpermissions: [PermissionFlagsBits.ManageMessages],
    botpermissions: [PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageNicknames],
    data: new SlashCommandBuilder()
        .setName('moderation')
        .setDescription('Ban, unban, kick, timeout, remove timeout, purge messages, or change the nickname of a user')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )
        .addSubcommand(subcommand => subcommand
            .setName('ban')
            .setDescription('Ban a user')
            .addUserOption(option => option
                .setName('user-id')
                .setDescription('The user to ban')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('reason')
                .setDescription('The reason for the ban')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('unban')
            .setDescription('Unban a user')
            .addUserOption(option => option
                .setName('user-id')
                .setDescription('The user to unban')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('kick')
            .setDescription('Kick a user')
            .addUserOption(option => option
                .setName('user-id')
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
            .setName('timeout')
            .setDescription('Timeout a user')
            .addUserOption(option => option
                .setName('user-id')
                .setDescription('The user to timeout')
                .setRequired(true)
            )
            .addNumberOption((option) =>
                option
                    .setName('duration')
                    .setDescription('How long do you want to timeout this user for?')
                    .setRequired(true)
                    .addChoices(
                        { name: '60 Seconds', value: 60000 },
                        { name: '5 Minutes', value: 60000 * 5 },
                        { name: '10 Minutes', value: 60000 * 10 },
                        { name: '1 Hour', value: 60000 * 60 },
                        { name: '1 Day', value: 60000 * 60 * 24 },
                        { name: '1 Week', value: 60000 * 60 * 24 * 7 },
                    )
            )
            .addStringOption(option => option
                .setName('reason')
                .setDescription('The reason for the timeout')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('remove-timeout')
            .setDescription('Remove a timeout from a user')
            .addUserOption(option => option
                .setName('user-id')
                .setDescription('The user to remove the timeout from')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('reason')
                .setDescription('The reason for removing the timeout')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('purge')
            .setDescription('Purge messages')
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
        ),
    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;
        const subcommand = options.getSubcommand();
        const targetUser = options.getUser('user-id')
        const targetMember = interaction.guild.members.cache.get(targetUser?.id);
        const reason = options.getString('reason') || 'No reason provided';
        const duration = options.getNumber('duration');
        const nickname = options.getString('nickname');
        var amount = options.getInteger('amount');
        
        switch (subcommand) {
            case 'ban':
                const auditLogReason = `Banned by @${interaction.user.tag} for: ${reason}`;

                if(targetUser.id === client.user.id) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('I cannot ban myself!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(targetUser.id === interaction.user.id) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('You cannot ban yourself!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(targetMember) {
                    if(targetMember.bannable === false) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setDescription(`Bot Missing Permissions | \`RoleHierarchy\``);
                        return await interaction.reply({ embeds: [Embed], ephemeral: true });
                    }

                    if(member.roles.highest.position <= targetMember.roles.highest.position) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setDescription(`You cannot ban a member with a higher role than you`);
                        return await interaction.reply({ embeds: [Embed], ephemeral: true });
                    }
                }

                const bans = await interaction.guild.bans.fetch();

                if(bans.has(targetUser.id)) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('This user is already banned!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                await guild.bans.create(targetUser.id, { reason: auditLogReason }).catch(console.error);
                
                if(targetMember) {
                    const embed = new EmbedBuilder()
							.setColor(Colors.Blurple)
							.setDescription(`You have been banned from **${guild.name}**`)
							.addFields(
								{ name: 'Reason', value: reason },
								{ name: 'Moderator', value: `@${user.username} | (${member})`, inline: true }
							)

						await targetMember.send({ embeds: [embed] }).catch(async (error) => {
							const Embed = new EmbedBuilder()
								.setColor(Colors.Blurple)
								.setDescription(`${targetMember} has DMs disabled, unable to send ban message`)
							await interaction.followUp({ embeds: [Embed], ephemeral: true });
						});
                }

                const banEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription(`You banned <@${targetUser.id}> from the server  `)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Moderator', value: `@${user.username} | (${member})`, inline: true }
                    );
                await interaction.reply({ embeds: [banEmbed], ephemeral: true });


                break;
            case 'unban':
                const fetchedBans = await interaction.guild.bans.fetch();
                const isUserBanned = fetchedBans.get(targetUser.id);

                if(!isUserBanned) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('This user is not banned!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                await interaction.guild.bans.remove(targetUser.id, `Unbanned by @${interaction.user.tag}`).catch(console.error);

                const unbanEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription(`You unbanned <@${targetUser.id}> from the server`)
                    .addFields(
                        { name: 'Moderator', value: `@${user.username} | (${member})`, inline: true }
                    );

                await interaction.reply({ embeds: [unbanEmbed], ephemeral: true });


                break;
            case 'kick':
                const auditLogReasonKick = `Kicked by @${interaction.user.tag} for: ${reason}`;

                if(targetUser.id === client.user.id) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('I cannot kick myself!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(targetUser.id === interaction.user.id) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('You cannot kick yourself!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(targetMember) {
                    if(targetMember.kickable === false) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setDescription(`Bot Missing Permissions | \`RoleHierarchy\``);
                        return await interaction.reply({ embeds: [Embed], ephemeral: true });
                    }

                    if(member.roles.highest.position <= targetMember.roles.highest.position) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setDescription(`You cannot kick a member with a higher role than you`);
                        return await interaction.reply({ embeds: [Embed], ephemeral: true });
                    }

                    const KickedEmbed = new EmbedBuilder()
                        .setColor(Colors.Blurple)
                        .setDescription(`You have been kicked from **${guild.name}**`)
                        .addFields(
                            { name: 'Reason', value: reason },
                            { name: 'Moderator', value: `@${user.username} | (${member})`, inline: true }
                        );

                    await targetMember.send({ embeds: [KickedEmbed] }).then( async () => 
                        await targetMember.kick({ reason: auditLogReasonKick })).catch(async (error) => {
                        const kickFailedDM = new EmbedBuilder()
                            .setColor(Colors.Blurple)
                            .setDescription(`${targetMember} has DMs disabled, unable to send kick message`)
                        await interaction.followUp({ embeds: [kickFailedDM], ephemeral: true });
                    });

                    const kickEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription(`You kicked <@${targetUser.id}> from the server`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Moderator', value: `@${user.username} | (${member})`, inline: true }
                    );

                    await interaction.reply({ embeds: [kickEmbed], ephemeral: true });
                } else {
                    const kickNotInServerEmbed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('This user is not in the server!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                break;
            case 'timeout':
                const auditLogReasonTimeout = `Timed out by @${interaction.user.tag} for: ${reason}`;
                const timeAfterTimeout = Date.now() + duration;

                if(targetUser.id === client.user.id) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('I cannot timeout myself!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(targetUser.id === interaction.user.id) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('You cannot timeout yourself!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(targetMember) {

                    if(targetMember.isCommunicationDisabled()) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setDescription('This user is already timed out!');
                        return await interaction.reply({ embeds: [Embed], ephemeral: true });
                    }

                    if(targetMember.roles.highest.position >= member.roles.highest.position) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setDescription(`You cannot timeout a member with a higher role than you`);
                        return await interaction.reply({ embeds: [Embed], ephemeral: true });
                    }

                    if(!targetMember.moderatable) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setDescription(`Bot Missing Permissions | \`RoleHierarchy\``);
                        return await interaction.reply({ embeds: [Embed], ephemeral: true });
                    }

                    const timeoutEmbed = new EmbedBuilder()
                        .setColor(Colors.Blurple)
                        .setDescription(`You have been timed out from **${guild.name}**`)
                        .addFields(
                            { name: 'Reason', value: reason },
                            { name: 'Moderator', value: `@${user.username} | (${member})`, inline: true },
                            { name: 'Ends', value: `<t:${(timeAfterTimeout/ 1000).toFixed(0)}:R>`, inline: false }
                        );

                    await targetMember.send({ embeds: [timeoutEmbed] }).catch(async (error) => {
                        const timeoutFailedDM = new EmbedBuilder()
                            .setColor(Colors.Blurple)
                            .setDescription(`${targetMember} has DMs disabled, unable to send timeout message`)
                        await interaction.followUp({ embeds: [timeoutFailedDM] });
                    });

                    await targetMember.timeout( duration, reason ).catch(console.error);

                    const timeoutSuccessEmbed = new EmbedBuilder()
                        .setColor(Colors.Blurple)
                        .setDescription(`You timed out <@${targetUser.id}> from the server`)
                        .addFields(
                            { name: 'Reason', value: reason },
                            { name: 'Moderator', value: `@${user.username} | (${member})`, inline: true },
                            { name: 'Ends', value: `<t:${(timeAfterTimeout/ 1000).toFixed(0)}:R>`, inline: false }
                        );

                    await interaction.reply({ embeds: [timeoutSuccessEmbed], ephemeral: true });                   
                    
                }

                break;
            case 'remove-timeout':

                if(!targetMember) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('This user is not in the server!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(targetUser.id === client.user.id) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('I cannot remove a timeout from myself!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(targetUser.id === interaction.user.id) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('You cannot remove a timeout from yourself!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(!targetMember.isCommunicationDisabled()) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('This user is not timed out!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                await targetMember.removeTimeout().catch(console.error);

                const removeTimeoutEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription(`You removed the timeout from <@${targetUser.id}>`)
                    .addFields(
                        { name: 'Moderator', value: `@${user.username} | (${member})`, inline: true }
                    );

                await interaction.reply({ embeds: [removeTimeoutEmbed], ephemeral: true });

                break;
            case 'purge':
                
                    if(!amount) amount = 100;
                    if(amount < 1 || amount > 100) {
                        const Embed = new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setDescription('You need to input a number between 1 and 100');
                        return await interaction.reply({ embeds: [Embed], ephemeral: true });
                    }

                    const messagesDeleted = await channel.bulkDelete(amount, true).catch(() => { return false });

                    const purgeEmbed = new EmbedBuilder()
                        .setColor(Colors.Blurple)
                        .setDescription(`Purged ${messagesDeleted.size} messages`)

                    const reply = await interaction.reply({ embeds: [purgeEmbed], ephemeral: true });

                    setTimeout(async () => {
                        const fetchedReply = await reply.fetch().catch(() => { return false });
                        if(fetchedReply) {
                            reply.delete()
                        }
                    }, 5000);

                break;

            case 'nickname':
                const oldNickname = targetMember.nickname || targetMember.user.displayName;

                if(!targetMember) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('This user is not in the server!');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(!targetMember.moderatable) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription(`Bot Missing Permissions | \`RoleHierarchy\``);
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(targetMember.roles.highest.position >= member.roles.highest.position) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription(`You cannot change the nickname of a member with a higher role than you`);
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(!nickname) {
                    // go back to display name
                    await targetMember.setNickname('', `Changed by @${interaction.user.tag}`).catch(console.error);

                    const removeNicknameEmbed = new EmbedBuilder()
                        .setColor(Colors.Blurple)
                        .setDescription(`You removed the nickname of <@${targetUser.id}>`)
                        .addFields(
                            { name: 'Old Nickname', value: oldNickname, inline: true },
                            { name: 'Moderator', value: `@${user.username} | (${member})`, inline: false }
                        );

                    return await interaction.reply({ embeds: [removeNicknameEmbed], ephemeral: true });
                    
                }

                if(nickname.length > 32) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('The nickname cannot be longer than 32 characters');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                if(nickname === oldNickname) {
                    const Embed = new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription('The nickname is already set to that');
                    return await interaction.reply({ embeds: [Embed], ephemeral: true });
                }

                await targetMember.setNickname(nickname, `Changed by @${interaction.user.tag}`).catch(console.error);

                const nicknameEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription(`You changed the nickname of <@${targetUser.id}>`)
                    .addFields(
                        { name: 'Old Nickname', value: oldNickname, inline: true },
                        { name: 'New Nickname', value: nickname, inline: true },
                        { name: 'Moderator', value: `@${user.username} | (${member})`, inline: false }
                    );

                await interaction.reply({ embeds: [nicknameEmbed], ephemeral: true });

                const targetNicknameEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription(`Your nickname was changed in **${guild.name}**`)
                    .addFields(
                        { name: 'Old Nickname', value: oldNickname, inline: true },
                        { name: 'New Nickname', value: nickname, inline: true },
                        { name: 'Moderator', value: `@${user.username} | (${member})`, inline: false }
                    );

                await targetMember.send({ embeds: [targetNicknameEmbed] }).catch(() => {});
                break;

            default:
                const Embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('Invalid subcommand');
                await interaction.reply({ embeds: [Embed], ephemeral: true });

                break;
            


                    
        }
    }

};