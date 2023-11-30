const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
	CommandInteraction,
} = require('discord.js');

const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
require('dotenv').config();
const MessageLogs = require('../../models/GuildMessageLogs.js');
const { EmbedColour, FooterImage, FooterText } = process.env;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('moderation')
		.setDescription('List of Moderation commands.')
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('ban')
				.setDescription('Banish a specified user from a guild.')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('Member to ban')
						.setRequired(false)
				)
				.addStringOption((option) =>
					option
						.setName('userid')
						.setDescription('Userid to ban')
						.setRequired(false)
				)
				.addStringOption((option) =>
					option
						.setName('reason')
						.setDescription('Reason for ban')
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('unban')
				.setDescription('Unban a specified user from a guild')
				.addStringOption((option) =>
					option
						.setName('userid')
						.setDescription('The specified userid to unban')
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('kick')
				.setDescription('Kick a specified user from a guild')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('Member to kick')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('reason')
						.setDescription('Reason for kick')
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('timeout')
				.setDescription('Timeout a specified user from a guild')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('Member to timeout')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('duration')
						.setDescription('How long do you want to timeout this user for?')
						.setRequired(true)
						.addChoices(
							{ name: '60 Seconds', value: '60Sec' },
							{ name: '5 Minutes', value: '5Min' },
							{ name: '10 Minutes', value: '10Min' },
							{ name: '1 Hour', value: '1Hour' },
							{ name: '1 Day', value: '1Day' },
							{ name: '1 Week', value: '1Week' }
						)
				)
				.addStringOption((option) =>
					option
						.setName('reason')
						.setDescription('Reason for the timeout.')
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('removetimeout')
				.setDescription('Remove a timeout from a specified user from a guild')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('Member to remove timeout')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('reason')
						.setDescription('Reason for removing timeout')
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('purge')
				.setDescription('Purge a specified amount of messages from a channel')
				.addIntegerOption((option) =>
					option
						.setName('amount')
						.setDescription('Amount of messages to purge')
						.setMaxValue(100)
						.setMinValue(1)
						.setRequired(false)
				)
		),
	/**
	 *
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		try {
			// Deconstructing interaction
			const { guild, member, options, user, client, channel } = interaction;

			// Checking if the user is in a guild
			if (!(await guildCheck(guild))) return;

			var botPermissionsArry;
			var userPermissionsArry;
			console.log(options.getSubcommand());
			switch (options.getSubcommand()) {
				case 'ban':
					botPermissionsArry = ['BanMembers'];
					userPermissionsArry = ['BanMembers'];
					break;
				case 'unban':
					botPermissionsArry = ['BanMembers'];
					userPermissionsArry = ['BanMembers'];
					break;
				case 'kick':
					botPermissionsArry = ['KickMembers'];
					userPermissionsArry = ['KickMembers'];
					break;
				case 'timeout':
					botPermissionsArry = ['ModerateMembers'];
					userPermissionsArry = ['ModerateMembers'];
					break;
				case 'removetimeout':
					botPermissionsArry = ['ModerateMembers'];
					userPermissionsArry = ['ModerateMembers'];
					break;
				case 'purge':
					botPermissionsArry = ['ManageMessages', 'ViewChannel'];
					userPermissionsArry = ['ManageMessages'];
					break;
			}

			const botPermissions = await permissionCheck(
				interaction,
				botPermissionsArry,
				client
			);

			if (!botPermissions[0])
				return await sendEmbed(
					interaction,
					`Bot Missing Permissions: \`${botPermissions[1]}\``
				);

			// User permissions
			const userPermissions = await permissionCheck(
				interaction,
				userPermissionsArry,
				member
			);

			if (!userPermissions[0])
				return await sendEmbed(
					interaction,
					`User Missing Permissions: \`${userPermissions[1]}\``
				);

			await sendEmbed(interaction, 'Attempting carry out moderation command');
			await sleep(2000);

			switch (options.getSubcommand()) {
				case 'ban':
					// Variables
					var targetMember = options.getMember('member');
					const targetUseridBan = options.getString('userid');
					var reason = options.getString('reason');
					var auditLogsReason;

					if (!targetMember && !targetUseridBan)
						return await sendEmbed(interaction, 'Please specify a user to ban');

					if (!targetMember && targetUseridBan) {
						targetMember =
							guild.members.cache.get(targetUseridBan) ||
							(await client.users.fetch(targetUseridBan).catch(() => {
								return false;
							}));
						if (!targetMember)
							return await sendEmbed(interaction, 'Could not find user');
					}
					if (targetMember.id === client.user.id)
						return await sendEmbed(interaction, 'You cannot ban me');

					if (targetMember.id === user.id)
						return await sendEmbed(interaction, 'You cannot ban yourself');

					if (!targetMember.bannable)
						return await sendEmbed(interaction, 'User is not bannable');

					if (
						member.roles.highest.position <= targetMember.roles.highest.position
					)
						return await sendEmbed(
							interaction,
							'You cannot ban a member with a higher role than you'
						);

					if (!reason) {
						reason = 'No reason provided';
						auditLogsReason = `Banned by @${user.username} | Reason: No reason provided`;
					} else {
						auditLogsReason = `Banned by @${user.username} | Reason: ${reason}`;
					}

					// Ban DM Embed
					const Embed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(`You have been banned from **${guild.name}**`)
						.addFields(
							{ name: 'Reason', value: reason },
							{
								name: 'Moderator',
								value: `@${user.username} | (${member})`,
								inline: true,
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await targetMember.send({ embeds: [Embed] }).catch(async (error) => {
						// await sendErrorEmbed(interaction, error);
						const Embed = new EmbedBuilder()
							.setColor(EmbedColour)
							.setDescription(
								`${targetMember} has DMs disabled, unable to send ban message`
							)
							.setTimestamp()
							.setFooter({ text: FooterText, iconURL: FooterImage });
						await interaction.editReply({ embeds: [Embed] });
						await sleep(5000);
					});

					// Ban the target user
					await targetMember
						.ban({
							deleteMessageSeconds: 60 * 60 * 24 * 7,
							reason: auditLogsReason,
						})
						.catch(async (error) => {
							return (
								(await sendErrorEmbed(interaction, error)) &&
								(await sendEmbed(
									interaction,
									`There was an error banning this user`
								))
							);
						});

					// Interaction reply embed
					const Embed2 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle('Ban')
						.setDescription(
							`You banned <@${targetMember.id}> from the server  `
						)
						.addFields(
							{ name: 'Reason', value: reason },
							{
								name: 'Moderator',
								value: `@${user.username} | (${member})`,
								inline: true,
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await interaction.editReply({ embeds: [Embed2] });

					break;
				case 'unban':
					// Variables
					const targetUseridUnban = options.getString('userid');

					const targetUserFetchedUnban = await client.users
						.fetch(targetUseridUnban)
						.catch(() => {
							return false;
						});

					if (!targetUserFetchedUnban)
						return await sendEmbed(interaction, 'Could not find user');

					if (targetUserFetchedUnban.id === client.user.id)
						return await sendEmbed(interaction, 'You cannot unban me');

					if (targetUserFetchedUnban.id === user.id)
						return await sendEmbed(interaction, 'You cannot unban yourself');

					const bannedUsers = await guild.bans.fetch().catch(async (error) => {
						return (
							(await sendErrorEmbed(interaction, error)) &&
							(await sendEmbed(
								interaction,
								`There was an error fetching the banned users`
							))
						);
					});

					if (!bannedUsers.has(targetUserFetchedUnban.id))
						return await sendEmbed(interaction, 'This user is not banned');

					// DM Unban Embed
					const UnbanEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(`• You have been unbanned from **${guild.name}** •`)
						.addFields({
							name: 'Moderator',
							value: `${user.username} | (${member})`,
							inline: true,
						})
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await targetUserFetchedUnban
						.send({ embeds: [UnbanEmbed] })
						.catch(async (error) => {
							await sendEmbed(
								interaction,
								`${targetUserFetchedUnban} has DMs disabled or does not have a common server with the bot, unable to send unban message`
							);
							await sleep(5000);
						});

					await guild.members
						.unban(targetUserFetchedUnban.id, `Unbanned by ${user.username}`)
						.catch(async (error) => {
							return (
								(await sendErrorEmbed(interaction, error)) &&
								(await sendEmbed(
									interaction,
									`There was an error unbanning this user`
								))
							);
						});

					// Interaction reply embed
					const UnbanEmbed2 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle('Unban')
						.setDescription(
							`You unbanned ${targetUserFetchedUnban} from the server  `
						)
						.addFields({
							name: 'Moderator',
							value: `@${user.username} | (${member})`,
							inline: true,
						})
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await interaction.editReply({ embeds: [UnbanEmbed2] });

					break;

				case 'kick':
					// Variables
					const targetMemberKick = options.getMember('member');
					var reasonKick = options.getString('reason');
					var auditLogsReasonKick;

					if (!targetMemberKick)
						return await sendEmbed(
							interaction,
							'Please specify a valid member'
						);

					// Checking if the target is the command user
					if (targetMemberKick.id === user.id)
						return await sendEmbed(interaction, 'You cannot kick yourself');

					// Checking if the target user is kickable
					if (!targetMemberKick.kickable)
						return await sendEmbed(
							interaction,
							`Bot Missing Permissions | \`RoleHierarchy\``
						);

					// Checking If the interaction member has a higher role than the target member
					if (
						member.roles.highest.position <=
						targetMemberKick.roles.highest.position
					)
						return await sendEmbed(
							interaction,
							'You cannot kick a member with equal or higher role than you'
						);

					if (!reasonKick) {
						reasonKick = 'No reason provided';
						auditLogsReasonKick = `Kicked by @${user.username} | Reason: No reason provided`;
					} else {
						auditLogsReasonKick = `Kicked by @${user.username} | Reason: ${reasonKick}`;
					}

					// DM Embed
					const EmbedKick = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(`You have been kicked from **${guild.name}**`)
						.addFields(
							{ name: 'Reason', value: reasonKick },
							{
								name: 'Moderator',
								value: `@${user.username} | (${member})`,
								inline: true,
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await targetMemberKick
						.send({ embeds: [EmbedKick] })
						.catch(async (error) => {
							// await sendErrorEmbed(interaction, error);
							const Embed = new EmbedBuilder()
								.setColor(EmbedColour)
								.setDescription(
									`${targetMemberKick} has DMs disabled, unable to send kick message`
								)
								.setTimestamp()
								.setFooter({ text: FooterText, iconURL: FooterImage });
							await interaction.editReply({ embeds: [Embed] });
							await sleep(5000);
						});

					await targetMemberKick
						.kick(auditLogsReasonKick)
						.catch(async (error) => {
							return (
								(await sendErrorEmbed(interaction, error)) &&
								(await sendEmbed(
									interaction,
									`There was an error kicking this user`
								))
							);
						});

					// Interaction reply embed
					const EmbedKick2 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle('Kick')
						.setDescription(
							`You kicked <@${targetMemberKick.id}> from the server  `
						)
						.addFields(
							{ name: 'Reason', value: reasonKick },
							{
								name: 'Moderator',
								value: `@${user.username} | (${member})`,
								inline: true,
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await interaction.editReply({ embeds: [EmbedKick2] });

					break;
				case 'timeout':
					// Variables
					const targetMemberTimeout = options.getMember('member');
					const duration = options.getString('duration');
					var reasonTimeout = options.getString('reason');
					var auditLogsReasonTimeout;
					var durationTime;

					if (!targetMemberTimeout)
						return await sendEmbed(
							interaction,
							'Please specify a valid member'
						);

					switch (duration) {
						case '60Sec':
							durationTime = 60000;
							break;
						case '5Min':
							durationTime = 60000 * 5;
							break;
						case '10Min':
							durationTime = 60000 * 10;
							break;
						case '1Hour':
							durationTime = 60000 * 60;
							break;
						case '1Day':
							durationTime = 60000 * 60 * 24;
							break;
						case '1Week':
							durationTime = 60000 * 60 * 24 * 7;
							break;
						default:
							return await sendEmbed(interaction, 'Invalid duration');
					}

					var timeAfterTimeout = Date.now() + durationTime;

					if (targetMemberTimeout.user.bot) {
						return await sendEmbed(interaction, 'You cannot timeout a bot');
					}

					if (targetMemberTimeout.id === user.id)
						return await sendEmbed(interaction, 'You cannot timeout yourself');

					if (!targetMemberTimeout.moderatable)
						return await sendEmbed(
							interaction,
							`Bot Missing Permissions | \`RoleHierarchy\``
						);

					if (
						member.roles.highest.position <=
						targetMemberTimeout.roles.highest.position
					)
						return await sendEmbed(
							interaction,
							'You cannot timeout a member with a higher role than you'
						);

					if (!reasonTimeout) {
						reasonTimeout = 'No reason provided';
						auditLogsReasonTimeout = `Timedout by @${user.username} | Reason: No reason provided`;
					} else {
						auditLogsReasonTimeout = `Timedout by @${user.username} | Reason: ${reasonTimeout}`;
					}

					// DM Embed
					const EmbedTimeout = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(`You have been timedout from **${guild.name}**`)
						.addFields(
							{ name: 'Reason', value: reasonTimeout },
							{
								name: 'Moderator',
								value: `@${user.username} | (${member})`,
								inline: true,
							},
							{
								name: 'Ends',
								value: `<t:${(timeAfterTimeout / 1000).toFixed(0)}:R>`,
								inline: false,
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await targetMemberTimeout
						.send({ embeds: [EmbedTimeout] })
						.catch(async (error) => {
							// await sendErrorEmbed(interaction, error);
							const Embed = new EmbedBuilder()
								.setColor(EmbedColour)
								.setDescription(
									`${targetMemberTimeout} has DMs disabled, unable to send timeout message`
								)
								.setTimestamp()
								.setFooter({ text: FooterText, iconURL: FooterImage });
							await interaction.editReply({ embeds: [Embed] });
							await sleep(5000);
						});

					await targetMemberTimeout
						.timeout(durationTime, auditLogsReasonTimeout)
						.catch(async (error) => {
							return (
								(await sendErrorEmbed(interaction, error)) &&
								(await sendEmbed(
									interaction,
									`There was an error timing out this user`
								))
							);
						});

					// Interaction reply embed
					const EmbedTimeout2 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle('Timeout')
						.setDescription(
							`You timedout <@${targetMemberTimeout.id}> from the server  `
						)
						.addFields(
							{ name: 'Reason', value: reasonTimeout },
							{
								name: 'Moderator',
								value: `@${user.username} | (${member})`,
								inline: true,
							},
							{
								name: 'Ends',
								value: `<t:${(timeAfterTimeout / 1000).toFixed(0)}:R>`,
								inline: false,
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await interaction.editReply({ embeds: [EmbedTimeout2] });

					break;
				case 'removetimeout':
					// Variables
					const targetMemberRemoveTimeout = options.getMember('member');
					var reasonRemoveTimeout = options.getString('reason');
					var auditLogsReasonRemoveTimeout;

					if (!targetMemberRemoveTimeout)
						return await sendEmbed(
							interaction,
							'Please specify a valid member'
						);

					if (targetMemberRemoveTimeout.id === user.id)
						return await sendEmbed(
							interaction,
							'You cannot remove a timeout from yourself'
						);

					if (!targetMemberRemoveTimeout.moderatable)
						return await sendEmbed(
							interaction,
							`Bot Missing Permissions | \`RoleHierarchy\``
						);

					if (
						member.roles.highest.position <=
						targetMemberRemoveTimeout.roles.highest.position
					)
						return await sendEmbed(
							interaction,
							'You cannot remove a timeout from a member with a higher role than you'
						);

					if (!targetMemberRemoveTimeout.isCommunicationDisabled()) {
						return await sendEmbed(interaction, 'User is not timedout');
					}

					if (!reasonRemoveTimeout) {
						reasonRemoveTimeout = 'No reason provided';
						auditLogsReasonRemoveTimeout = `Removed Timeout by @${user.username} | Reason: No reason provided`;
					} else {
						auditLogsReasonRemoveTimeout = `Removed Timeout by @${user.username} | Reason: ${reasonRemoveTimeout}`;
					}

					// DM Embed
					const EmbedRemoveTimeout = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(
							`Your timeout has been removed from **${guild.name}**`
						)
						.addFields(
							{ name: 'Reason', value: reasonRemoveTimeout },
							{
								name: 'Moderator',
								value: `@${user.username} | (${member})`,
								inline: true,
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await targetMemberRemoveTimeout
						.send({ embeds: [EmbedRemoveTimeout] })
						.catch(async (error) => {
							// await sendErrorEmbed(interaction, error);
							const Embed = new EmbedBuilder()
								.setColor(EmbedColour)
								.setDescription(
									`${targetMemberRemoveTimeout} has DMs disabled, unable to send remove timeout message`
								)
								.setTimestamp()
								.setFooter({ text: FooterText, iconURL: FooterImage });
							await interaction.editReply({ embeds: [Embed] });
							await sleep(5000);
						});

					// remove timeout on target member
					await targetMemberRemoveTimeout
						.timeout(null, auditLogsReasonRemoveTimeout)
						.catch(async (error) => {
							return (
								(await sendErrorEmbed(interaction, error)) &&
								(await sendEmbed(
									interaction,
									`There was an error removing the timeout from this user`
								))
							);
						});

					// Interaction reply embed
					const EmbedRemoveTimeout2 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle('Remove Timeout')
						.setDescription(
							`You removed the timeout from <@${targetMemberRemoveTimeout.id}> from the server  `
						)
						.addFields(
							{ name: 'Reason', value: reasonRemoveTimeout },
							{
								name: 'Moderator',
								value: `@${user.username} | (${member})`,
								inline: true,
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await interaction.editReply({ embeds: [EmbedRemoveTimeout2] });
					break;

				case 'purge':
					// Variables
					var amount = options.getInteger('amount');
					if (!amount) amount = 100;
					if (amount < 1 || amount > 100)
						return await sendEmbed(
							interaction,
							'Please provide a number between 1 and 100'
						);

					const messagesDeleted = await channel
						.bulkDelete(amount, true)
						.catch(async (error) => {
							return false;
						});

					const EmbedPurge = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(`Deleted ${messagesDeleted.size || 0} messages`)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					const reply = await interaction.followUp({
						embeds: [EmbedPurge],
					});

					await sleep(5000);
					const fetchedMessage = await reply.fetch().catch(() => {
						return false;
					});

					if (fetchedMessage) {
						await reply.delete();
					}

					const MessageLogsData = await MessageLogs.findOne({
						guild: guild.id,
					});

					if (!MessageLogsData) return;

					const channelToSend =
						guild.channels.cache.get(MessageLogsData.channel) ||
						guild.channels.fetch(MessageLogsData.channel).catch(() => {
							return false;
						});

					if (!channelToSend) {
						await MessageLogs.findOneAndDelete({ guildId: guild.id });
						await sendEmbed(
							await guild.fetchOwner(),
							`Message Logs channel was deleted or changed | Message Logs is now \`disabled\``
						);
						return;
					}

					const botPermissionsArry2 = ['SendMessages', 'ViewChannel'];
					const botPermissions2 = await permissionCheck(
						channelToSend,
						botPermissionsArry2,
						client
					);

					if (!botPermissions2[0]) {
						await MessageLogs.findOneAndDelete({ guildId: guild.id });
						return await sendEmbed(
							await guild.fetchOwner(),
							`Bot Missing Permissions: \`${botPermissions2[1]}\` in channel : ${channelToSend} | Message Logs is now \`disabled\``
						);
					}

					await sendEmbed(
						channelToSend,
						`${member} Used the /purge in ${channel}`
					);

					break;

				default:
					return await sendEmbed(interaction, 'Something went wrong 2');
			}
		} catch (error) {
			console.error(error);
			await sendErrorEmbed(interaction, error);
			await sendEmbed(
				interaction,
				`There was an error running this command\n\n${error}`
			);
			return;
		}
	},
};
