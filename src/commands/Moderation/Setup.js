const {
	SlashCommandBuilder,
	EmbedBuilder,
	ChannelType,
	PermissionFlagsBits,
	Role,
	User,
	GuildMember,
	Guild,
	Client,
	CommandInteraction,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const { FooterText, FooterImage, EmbedColour, SteamAPIKey } = process.env;
const welcomeMessagesSchema = require('../../models/WelcomeMessages.js');
const levelNotificationsSchema = require('../../models/LevelNotifications.js');
// const inviteTrackerSchema = require('../../models/InviteTracker.js');
const ChannelLogs = require('../../models/GuildChannelLogs.js');
const MemberLogs = require('../../models/GuildMemberLogs.js');
const RoleLogs = require('../../models/GuildRoleLogs.js');
const ServerLogs = require('../../models/GuildServerLogs.js');
const VoiceLogs = require('../../models/GuildVoiceLogs.js');
const JoinLeaveLogs = require('../../models/GuildJoinLeaveLogs.js');
const MessageLogs = require('../../models/GuildMessageLogs.js');
const GuildTicketsSetup = require('../../models/GuildTicketsSetup.js');
const GuildPolls = require('../../models/GuildPolls.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Setup the bot for your server.')
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('welcome-messages')
				.setDescription('Setup the welcome messages.')
				.addChannelOption((option) =>
					option
						.setName('welcome-messages-channel')
						.setDescription(
							'The channel you would like to send the welcome messages in.'
						)
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true)
				)
				.addBooleanOption((option) =>
					option
						.setName('toggle-welcome-messages')
						.setDescription('Toggle the welcome messages.')
						.setRequired(true)
				)
				.addRoleOption((option) =>
					option
						.setName('welcome-messages-role')
						.setDescription(
							'The role you would like to give to the user when they join.'
						)
						.setRequired(false)
				)
				.addStringOption((option) =>
					option
						.setName('welcome-messages-message')
						.setDescription('The message you would like to send.')
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('level-notifications')
				.setDescription('Enable/disable level notifications.')
				.addBooleanOption((option) =>
					option
						.setName('level-notifications-toggle')
						.setDescription('Toggle the level messages.')
						.setRequired(true)
				)
				.addChannelOption((option) =>
					option
						.setName('level-notifications-channel')
						.setDescription(
							'The channel you would like to send the level messages in.'
						)
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('tickets')
				.setDescription('Setup tickets for the guild.')
				.addChannelOption((option) =>
					option
						.setName('tickets-channel')
						.setDescription('Channel to send the ticket embed in.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true)
				)
				.addChannelOption((option) =>
					option
						.setName('tickets-category')
						.setDescription('Category to put the tickets in.')
						.addChannelTypes(ChannelType.GuildCategory)
						.setRequired(true)
				)
				.addChannelOption((option) =>
					option
						.setName('archive-channel')
						.setDescription('Channel to send transcripts in.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true)
				)
				.addRoleOption((option) =>
					option
						.setName('mod-role')
						.setDescription('Role so staff can see the tickets.')
						.setRequired(true)
				)
				.addRoleOption((option) =>
					option
						.setName('admin-role')
						.setDescription('Role so admins can see the tickets.')
						.setRequired(true)
				)
		)

		.addSubcommand((subcommand) =>
			subcommand
				.setName('poll')
				.setDescription('Setup a poll channel.')
				.addChannelOption((option) =>
					option
						.setName('poll-channel')
						.setDescription('Channel to send the poll embed.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true)
				)
		)

		.addSubcommand((subcommand) =>
			subcommand
				.setName('logs')
				.setDescription('Setup logs for the guild.')
				.addStringOption((option) =>
					option
						.setName('type')
						.setDescription('Type of logs to setup.')
						.addChoices(
							{
								name: 'Channel Logs',
								value: 'channel',
							},
							{
								name: 'Member Logs',
								value: 'member',
							},
							{
								name: 'Message Logs',
								value: 'message',
							},
							{
								name: 'Joins/Leaves Logs',
								value: 'joinleave',
							},
							{
								name: 'Role Logs',
								value: 'role',
							},
							{
								name: 'Server Logs',
								value: 'server',
							},
							{
								name: 'Voice Logs',
								value: 'voice',
							}
						)
						.setRequired(true)
				)
				.addBooleanOption((option) =>
					option
						.setName('logs-toggle')
						.setDescription('Enable or disable the channel logs.')
						.setRequired(true)
				)
				.addChannelOption((option) =>
					option
						.setName('logs-channel')
						.setDescription('Channel to send the channel logs in.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(false)
				)
		),
	/**
	 * @param {CommandInteraction} interaction
	 * @param {Client} client
	 * @param {import('discord.js').Channel} levelNotificationsChannel
	 */
	async execute(interaction) {
		try {
			// Deconstructing interaction
			const { guild, member, options, user, client, channel } = interaction;

			// Checking if the user is in a guild
			if (!(await guildCheck(guild))) return;

			// Bot permissions
			const botPermissionsArry = ['ManageMessages', 'ManageRoles'];
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
			const userPermissionsArry = ['ManageRoles'];
			const userPermissions = await permissionCheck(
				interaction,
				userPermissionsArry,
				member
			);

			if (!userPermissions[0] || user.id !== '387341502134878218')
				return await sendEmbed(
					interaction,
					`User Missing Permissions: \`${userPermissions[1]}\``
				);

			await sendEmbed(interaction, 'Gathering setup information ');
			await sleep(2000);

			switch (options.getSubcommand()) {
				case 'poll':
					const pollChannel = options.getChannel('poll-channel');

					if (pollChannel) {
						// Bot permissions
						const botPermissionsArry = ['SendMessages', 'ViewChannel'];
						const botPermissions = await permissionCheck(
							pollChannel,
							botPermissionsArry,
							client
						);

						if (!botPermissions[0])
							return await sendEmbed(
								interaction,
								`Bot Missing Permissions: \`${botPermissions[1]}\` in ${messageLogsChannel}`
							);

						await GuildPolls.findOneAndUpdate(
							{
								guild: guild.id,
							},
							{
								guild: guild.id,
								channel: pollChannel.id,
							},
							{
								upsert: true,
							}
						);

						const SuccessEmbed = new EmbedBuilder()
							.setColor(EmbedColour)
							.setDescription('• Polls Setup Successfully •')
							.addFields({
								name: '• Channel •',
								value: `${pollChannel}`,
							})
							.setTimestamp()
							.setFooter({ text: FooterText, iconURL: FooterImage });
						await interaction.editReply({ embeds: [SuccessEmbed] });
					} else {
						await MessageLogs.deleteOne({
							guild: guild.id,
						});

						return await sendEmbed(
							interaction,
							'Message logs have been disabled'
						);
					}

					break;
				case 'tickets':
					const ticketsChannel = options.getChannel('tickets-channel');
					const openCategory = options.getChannel('tickets-category');
					const archiveChannel = options.getChannel('archive-channel');
					const modRole = options.getRole('mod-role');
					const adminRole = options.getRole('admin-role');

					// Bot permissions
					const botPermissionsArrayTicket = [
						'SendMessages',
						'ViewChannel',
						'ManageChannels',
					];
					const botPermissionsTicket = await permissionCheck(
						ticketsChannel,
						botPermissionsArrayTicket,
						client
					);

					if (!botPermissionsTicket[0]) {
						await sendEmbed(
							interaction,
							`Bot Missing Permissions: \`${botPermissionsTicket[1]}\` in ${ticketsChannel}`
						);
						return;
					}

					// Bot permissions
					const botPermissionsArrayArchive = [
						'SendMessages',
						'ViewChannel',
						'ManageChannels',
					];
					const botPermissionsArchive = await permissionCheck(
						archiveChannel,
						botPermissionsArrayArchive,
						client
					);

					if (!botPermissionsArchive[0]) {
						await sendEmbed(
							interaction,
							`Bot Missing Permissions: \`${botPermissionsArchive[1]}\` in ${archiveChannel}`
						);
						return;
					}

					if (!openCategory) {
						await sendEmbed(
							interaction,
							'Please provide a category for the open and closed tickets'
						);
						return;
					}

					if (
						modRole.position >= guild.members.me.roles.highest.position ||
						adminRole.position >= guild.members.me.roles.highest.position
					) {
						await sendEmbed(
							interaction,
							'Bot Missing Permissions: `RoleHierarchy`'
						);
						return;
					}

					await sendEmbed(interaction, 'Creating tickets channel');

					const ticketEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle(`${guild.name} | Tickets`)
						.setDescription(
							'Click the button below to create a ticket, This will create a channel for you to talk to staff in confidence.'
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					const LinkButton = new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setStyle(ButtonStyle.Primary)
							.setLabel('Create Ticket')
							.setCustomId('ovx-ticket')
					);

					await ticketsChannel.send({
						embeds: [ticketEmbed],
						components: [LinkButton],
					});

					// save data to database

					await GuildTicketsSetup.findOneAndUpdate(
						{ guild: guild.id },
						{
							guild: guild.id,
							ticketChannel: ticketsChannel.id,
							openCategory: openCategory.id,
							archiveChannel: archiveChannel.id,
							modRole: modRole.id,
							adminRole: adminRole.id,
						},
						{
							upsert: true,
						}
					);

					await sendEmbed(interaction, 'Tickets setup successfully');

					break;
				case 'welcome-messages':
					const welcomeMessagesChannel = options.getChannel(
						'welcome-messages-channel'
					);
					const welcomeMessagesRole = options.getRole('welcome-messages-role');
					const welcomeMessagesMessage = options.getString(
						'welcome-messages-message'
					);
					const toggleWelcomeMessages = options.getBoolean(
						'toggle-welcome-messages'
					);

					// Bot permissions
					const botPermissionsArry = ['SendMessages', 'ViewChannel'];
					const botPermissions = await permissionCheck(
						welcomeMessagesChannel,
						botPermissionsArry,
						client
					);

					if (!botPermissions[0])
						return await sendEmbed(
							interaction,
							`Bot Missing Permissions: \`${botPermissions[1]}\``
						);

					if (welcomeMessagesChannel.type !== ChannelType.GuildText)
						return await sendEmbed(
							interaction,
							'Please provide a text channel'
						);

					// Check if channel is above the bot
					if (
						welcomeMessagesRole &&
						welcomeMessagesRole.position >=
							guild.members.me.roles.highest.position
					)
						return await sendEmbed(
							interaction,
							'Bot Missing Permissions: `RoleHierarchy`'
						);

					if (welcomeMessagesMessage && welcomeMessagesMessage.length > 2000)
						return await sendEmbed(
							interaction,
							'Please provide a message that is less than 2000 characters'
						);

					const welcomeMessagesData = await welcomeMessagesSchema.findOne({
						guild: guild.id,
					});

					if (welcomeMessagesData) {
						if (!toggleWelcomeMessages) {
							await welcomeMessagesSchema.findOneAndDelete({
								guild: guild.id,
							});

							return await sendEmbed(
								interaction,
								'Welcome Messages have been disabled'
							);
						}
					}

					if (!toggleWelcomeMessages) {
						return await sendEmbed(
							interaction,
							'There was no data found for welcome messages'
						);
					}

					await welcomeMessagesSchema.findOneAndUpdate(
						{
							guild: guild.id,
						},
						{
							guild: guild.id,
							channel: welcomeMessagesChannel.id,
							message: welcomeMessagesMessage ? welcomeMessagesMessage : null,
							role: welcomeMessagesRole ? welcomeMessagesRole.id : null,
						},
						{
							upsert: true,
						}
					);

					const SuccessEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription('• Welcome Messages Setup Successfully •')
						.addFields(
							{
								name: '• Welcome Message Channel •',
								value: `${welcomeMessagesChannel}`,
							},
							{
								name: '• Welcome Message •',
								value: welcomeMessagesMessage
									? `${welcomeMessagesMessage || 'None'}`
									: 'None',
							},
							{
								name: '• Welcome Role •',
								value: welcomeMessagesRole ? `${welcomeMessagesRole}` : 'None',
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });
					await interaction.editReply({ embeds: [SuccessEmbed] });

					break;
				case 'level-notifications':
					const levelNotificationsChannel = options.getChannel(
						'level-notifications-channel'
					);

					const levelNotificationsToggle = options.getBoolean(
						'level-notifications-toggle'
					);

					const levelNotificationsData = await levelNotificationsSchema.findOne(
						{
							guild: guild.id,
						}
					);
					if (levelNotificationsData) {
						if (!levelNotificationsToggle) {
							await levelNotificationsSchema.findOneAndReplace(
								{
									guild: guild.id,
								},
								{
									guild: guild.id,
									notifications: levelNotificationsToggle,
								}
							);

							return await sendEmbed(
								interaction,
								'Level notifications have been disabled'
							);
						}
					}

					if (!levelNotificationsToggle) {
						// set in database to false
						await levelNotificationsSchema.create({
							guild: guild.id,
							notifications: levelNotificationsToggle,
						});
						return await sendEmbed(
							interaction,
							'Level notifications have been disabled'
						);
					}

					// if channel was provided
					if (levelNotificationsChannel) {
						// Bot permissions
						const botPermissionsArry2 = ['ManageMessages'];
						const botPermissions2 = await permissionCheck(
							levelNotificationsChannel,
							botPermissionsArry2,
							client
						);

						if (!botPermissions2[0])
							return await sendEmbed(
								interaction,
								`Bot Missing Permissions: \`${botPermissions2[1]}\``
							);

						if (levelNotificationsChannel.type !== ChannelType.GuildText)
							return await sendEmbed(
								interaction,
								'Please provide a text channel'
							);
					}

					await levelNotificationsSchema.findOneAndUpdate(
						{
							guild: guild.id,
						},
						{
							guild: guild.id,
							channel: levelNotificationsChannel
								? levelNotificationsChannel.id
								: null,
							notifications: levelNotificationsToggle,
						},
						{
							upsert: true,
						}
					);

					const SuccessEmbed2 = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription('• Level Notifications Setup Successfully •')
						.addFields(
							{
								name: '• Level Notifications Channel •',
								value: `${levelNotificationsChannel || 'Message channel'} `,
							},
							{
								name: '• Toggle •',
								value: `${levelNotificationsToggle}`,
							}
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });
					await interaction.editReply({ embeds: [SuccessEmbed2] });
					break;
				case 'logs':
					const logsType = options.getString('type');
					const logsToggle = options.getBoolean('logs-toggle');

					switch (logsType) {
						case 'message':
							const messageLogsChannel = options.getChannel('logs-channel');
							if (logsToggle) {
								if (!messageLogsChannel) {
									return await sendEmbed(
										interaction,
										'Please provide a channel'
									);
								}

								// Bot permissions
								const botPermissionsArry = ['SendMessages', 'ViewChannel'];
								const botPermissions = await permissionCheck(
									messageLogsChannel,
									botPermissionsArry,
									client
								);

								if (!botPermissions[0])
									return await sendEmbed(
										interaction,
										`Bot Missing Permissions: \`${botPermissions[1]}\` in ${messageLogsChannel}`
									);

								await MessageLogs.findOneAndUpdate(
									{
										guild: guild.id,
									},
									{
										guild: guild.id,
										channel: messageLogsChannel.id,
									},
									{
										upsert: true,
									}
								);

								const SuccessEmbed = new EmbedBuilder()
									.setColor(EmbedColour)
									.setDescription('• Message Logs Setup Successfully •')
									.addFields({
										name: '• Channel •',
										value: `${messageLogsChannel}`,
									})
									.setTimestamp()
									.setFooter({ text: FooterText, iconURL: FooterImage });
								await interaction.editReply({ embeds: [SuccessEmbed] });
							} else {
								await MessageLogs.deleteOne({
									guild: guild.id,
								});

								return await sendEmbed(
									interaction,
									'Message logs have been disabled'
								);
							}

							break;
						case 'joinleave':
							const joinLeaveLogsChannel = options.getChannel('logs-channel');
							if (logsToggle) {
								if (!joinLeaveLogsChannel) {
									return await sendEmbed(
										interaction,
										'Please provide a channel'
									);
								}

								// Bot permissions
								const botPermissionsArry = ['SendMessages', 'ViewChannel'];
								const botPermissions = await permissionCheck(
									joinLeaveLogsChannel,
									botPermissionsArry,
									client
								);

								if (!botPermissions[0])
									return await sendEmbed(
										interaction,
										`Bot Missing Permissions: \`${botPermissions[1]}\` in ${joinLeaveLogsChannel}`
									);

								await JoinLeaveLogs.findOneAndUpdate(
									{
										guild: guild.id,
									},
									{
										guild: guild.id,
										channel: joinLeaveLogsChannel.id,
									},
									{
										upsert: true,
									}
								);

								const SuccessEmbed = new EmbedBuilder()
									.setColor(EmbedColour)
									.setDescription('• Join/Leave Logs Setup Successfully •')
									.addFields({
										name: '• Channel •',
										value: `${joinLeaveLogsChannel}`,
									})
									.setTimestamp()
									.setFooter({ text: FooterText, iconURL: FooterImage });
								await interaction.editReply({ embeds: [SuccessEmbed] });
							} else {
								await JoinLeaveLogs.deleteOne({
									guild: guild.id,
								});

								return await sendEmbed(
									interaction,
									'Join/Leave logs have been disabled'
								);
							}

							break;
						case 'channel':
							const ChannelLogsChannel = options.getChannel('logs-channel');
							if (logsToggle) {
								if (!ChannelLogsChannel) {
									return await sendEmbed(
										interaction,
										'Please provide a channel'
									);
								}

								// Bot permissions
								const botPermissionsArry = ['SendMessages', 'ViewChannel'];
								const botPermissions = await permissionCheck(
									ChannelLogsChannel,
									botPermissionsArry,
									client
								);

								if (!botPermissions[0])
									return await sendEmbed(
										interaction,
										`Bot Missing Permissions: \`${botPermissions[1]}\` in ${ChannelLogsChannel}`
									);

								await ChannelLogs.findOneAndUpdate(
									{
										guild: guild.id,
									},
									{
										guild: guild.id,
										channel: ChannelLogsChannel.id,
									},
									{
										upsert: true,
									}
								);

								const SuccessEmbed = new EmbedBuilder()
									.setColor(EmbedColour)
									.setDescription('• Channel Logs Setup Successfully •')
									.addFields({
										name: '• Channel •',
										value: `${ChannelLogsChannel}`,
									})
									.setTimestamp()
									.setFooter({ text: FooterText, iconURL: FooterImage });
								await interaction.editReply({ embeds: [SuccessEmbed] });
							} else {
								await ChannelLogs.deleteOne({
									guild: guild.id,
								});

								return await sendEmbed(
									interaction,
									'Channel logs have been disabled'
								);
							}

							break;
						case 'member':
							const MemberLogsChannel = options.getChannel('logs-channel');
							if (logsToggle) {
								if (!MemberLogsChannel) {
									return await sendEmbed(
										interaction,
										'Please provide a channel'
									);
								}

								// Bot permissions
								const botPermissionsArry = ['SendMessages', 'ViewChannel'];
								const botPermissions = await permissionCheck(
									MemberLogsChannel,
									botPermissionsArry,
									client
								);

								if (!botPermissions[0])
									return await sendEmbed(
										interaction,
										`Bot Missing Permissions: \`${botPermissions[1]}\` in ${MemberLogsChannel}`
									);

								await MemberLogs.findOneAndUpdate(
									{
										guild: guild.id,
									},
									{
										guild: guild.id,
										channel: MemberLogsChannel.id,
									},
									{
										upsert: true,
									}
								);

								const SuccessEmbed = new EmbedBuilder()
									.setColor(EmbedColour)
									.setDescription('• Member Logs Setup Successfully •')
									.addFields({
										name: '• Channel •',
										value: `${MemberLogsChannel}`,
									})
									.setTimestamp()
									.setFooter({ text: FooterText, iconURL: FooterImage });
								await interaction.editReply({ embeds: [SuccessEmbed] });
							} else {
								await MemberLogs.deleteOne({
									guild: guild.id,
								});

								return await sendEmbed(
									interaction,
									'Member logs have been disabled'
								);
							}

							break;
						case 'role':
							const RoleLogsChannel = options.getChannel('logs-channel');
							if (logsToggle) {
								if (!RoleLogsChannel) {
									return await sendEmbed(
										interaction,
										'Please provide a channel'
									);
								}

								// Bot permissions
								const botPermissionsArry = ['SendMessages', 'ViewChannel'];
								const botPermissions = await permissionCheck(
									RoleLogsChannel,
									botPermissionsArry,
									client
								);

								if (!botPermissions[0])
									return await sendEmbed(
										interaction,
										`Bot Missing Permissions: \`${botPermissions[1]}\` in ${RoleLogsChannel}`
									);

								await RoleLogs.findOneAndUpdate(
									{
										guild: guild.id,
									},
									{
										guild: guild.id,
										channel: RoleLogsChannel.id,
									},
									{
										upsert: true,
									}
								);

								const SuccessEmbed = new EmbedBuilder()
									.setColor(EmbedColour)
									.setDescription('• Role Logs Setup Successfully •')
									.addFields({
										name: '• Channel •',
										value: `${RoleLogsChannel}`,
									})
									.setTimestamp()
									.setFooter({ text: FooterText, iconURL: FooterImage });
								await interaction.editReply({ embeds: [SuccessEmbed] });
							} else {
								await RoleLogs.deleteOne({
									guild: guild.id,
								});

								return await sendEmbed(
									interaction,
									'Role logs have been disabled'
								);
							}

							break;

						case 'server':
							const ServerLogsChannel = options.getChannel('logs-channel');
							if (logsToggle) {
								if (!ServerLogsChannel) {
									return await sendEmbed(
										interaction,
										'Please provide a channel'
									);
								}

								// Bot permissions
								const botPermissionsArry = ['SendMessages', 'ViewChannel'];
								const botPermissions = await permissionCheck(
									ServerLogsChannel,
									botPermissionsArry,
									client
								);

								if (!botPermissions[0])
									return await sendEmbed(
										interaction,
										`Bot Missing Permissions: \`${botPermissions[1]}\` in ${ServerLogsChannel}`
									);

								await ServerLogs.findOneAndUpdate(
									{
										guild: guild.id,
									},
									{
										guild: guild.id,
										channel: ServerLogsChannel.id,
									},
									{
										upsert: true,
									}
								);

								const SuccessEmbed = new EmbedBuilder()
									.setColor(EmbedColour)
									.setDescription('• Server Logs Setup Successfully •')
									.addFields(
										{
											name: '• Channel •',
											value: `${ServerLogsChannel}`,
										},
										{
											name: '• Server Logs •',
											value: `This is a work in progress, please be patient for this feature to role out c:`,
										}
									)
									.setTimestamp()
									.setFooter({ text: FooterText, iconURL: FooterImage });
								await interaction.editReply({ embeds: [SuccessEmbed] });
							} else {
								await ServerLogs.deleteOne({
									guild: guild.id,
								});

								return await sendEmbed(
									interaction,
									'Server logs have been disabled'
								);
							}

							break;

						case 'voice':
							const VoiceLogsChannel = options.getChannel('logs-channel');
							if (logsToggle) {
								if (!VoiceLogsChannel) {
									return await sendEmbed(
										interaction,
										'Please provide a channel'
									);
								}

								// Bot permissions
								const botPermissionsArry = ['SendMessages', 'ViewChannel'];
								const botPermissions = await permissionCheck(
									VoiceLogsChannel,
									botPermissionsArry,
									client
								);

								if (!botPermissions[0])
									return await sendEmbed(
										interaction,
										`Bot Missing Permissions: \`${botPermissions[1]}\` in ${VoiceLogsChannel}`
									);

								await VoiceLogs.findOneAndUpdate(
									{
										guild: guild.id,
									},
									{
										guild: guild.id,
										channel: VoiceLogsChannel.id,
									},
									{
										upsert: true,
									}
								);

								const SuccessEmbed = new EmbedBuilder()
									.setColor(EmbedColour)
									.setDescription('• Voice Logs Setup Successfully •')
									.addFields(
										{
											name: '• Channel •',
											value: `${VoiceLogsChannel}`,
										},
										{
											name: '• Voice Logs •',
											value: `This is a work in progress, please be patient for this feature to role out c:`,
										}
									)
									.setTimestamp()
									.setFooter({ text: FooterText, iconURL: FooterImage });
								await interaction.editReply({ embeds: [SuccessEmbed] });
							} else {
								await VoiceLogs.deleteOne({
									guild: guild.id,
								});

								return await sendEmbed(
									interaction,
									'Voice logs have been disabled'
								);
							}

							break;
						default:
							break;
					}

				default:
					break;
			}
		} catch (error) {}
	},
};
