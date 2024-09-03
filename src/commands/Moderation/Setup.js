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
	TextChannel,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	RoleSelectMenuBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const {
	FooterText,
	FooterImage,
	EmbedColour,
	DeveloperGuildID,
	PremiumUserRoleID,
} = process.env;
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
const GuildSuggestionsChannels = require('../../models/GuildSuggestionChannels.js');
const GuildPollChannels = require('../../models/GuildPollChannels.js');
const GuildLevelRewards = require('../../models/GuildLevelRewards.js');
const GuildSelectRoles = require('../../models/GuildSelectRoles.js');
const GuildInviteDetection = require('../../models/GuildInviteDetection.js');
const GuildXPBoosters = require('../../models/GuildXPBoosters.js');

module.exports = {
	cooldown: 5,
	catagory: 'Moderation',
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
				.setName('invite-detection')
				.setDescription('Setup invite detection for the guild.')
				.addBooleanOption((option) =>
					option
						.setName('invite-detection-toggle')
						.setDescription('Toggle the invite detection.')
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('level-rewards')
				.setDescription('Setup level rewards for the guild.')
				.addStringOption((option) =>
					option
						.setName('type')
						.setDescription('Add or remove a level reward.')
						.addChoices(
							{
								name: 'Add',
								value: 'add',
							},
							{
								name: 'Remove',
								value: 'remove',
							}
						)
						.setRequired(true)
				)
				.addRoleOption((option) =>
					option
						.setName('role')
						.setDescription('Role to give when a user reaches a level.')
						.setRequired(true)
				)
				.addIntegerOption((option) =>
					option
						.setName('level')
						.setDescription('Level to give the role at.')
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('xp-booster')
				.setDescription('Setup xp booster roles for the guild.')
				.addRoleOption((option) =>
					option
						.setName('role')
						.setDescription('Role to give when a user reaches a level.')
						.setRequired(true)
				)
				.addIntegerOption((option) =>
					option
						.setName('percentage')
						.setDescription('Percentage to boost the xp by. (1-100)')
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('select-role')
				.setDescription('Setup select roles for the guild.')
				.addStringOption((option) =>
					option
						.setName('type')
						.setDescription('Add or remove a role.')
						.addChoices(
							{
								name: 'Add',
								value: 'add',
							},
							{
								name: 'Remove',
								value: 'remove',
							}
						)
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('title')
						.setDescription('Title of the select role message.')
						.setRequired(true)
				)
				.addRoleOption((option) =>
					option
						.setName('role')
						.setDescription('Role to give when a user reaches a level.')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('description')
						.setDescription('Description of the role.')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('emoji')
						.setDescription('Emoji to give the role at.')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('messageid')
						.setDescription('Message ID of the select role message.')
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
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('basics')
				.setDescription('Basic setup for the guild.')
				.addStringOption((option) =>
					option
						.setName('type')
						.setDescription('What would you like to setup?')
						.addChoices(
							{
								name: 'Suggestions',
								value: 'suggestions',
							},
							{
								name: 'Polls',
								value: 'polls',
							}
						)
						.setRequired(true)
				)
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('The target Channel')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true)
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

			if (!userPermissions[0])
				return await sendEmbed(
					interaction,
					`User Missing Permissions: \`${userPermissions[1]}\``
				);

			await sendEmbed(interaction, 'Gathering setup information ');
			await sleep(2000);

			switch (options.getSubcommand()) {
				case 'invite-detection':
					const inviteDetectionToggle = options.getBoolean(
						'invite-detection-toggle'
					);

					const inviteDetectionData = await GuildInviteDetection.findOne({
						guildId: guild.id,
					});
					if (inviteDetectionToggle) {
						if (inviteDetectionData) {
							return await sendEmbed(
								interaction,
								'Invite Detection is already enabled'
							);
						}

						await GuildInviteDetection.create({
							guildId: guild.id,
						});

						return await sendEmbed(
							interaction,
							'Invite Detection has been enabled'
						);
					} else {
						if (!inviteDetectionData) {
							return await sendEmbed(
								interaction,
								'Invite Detection is already disabled'
							);
						}

						await GuildInviteDetection.findOneAndDelete({
							guildId: guild.id,
						});

						return await sendEmbed(
							interaction,
							'Invite Detection has been disabled'
						);
					}

					break;
				case 'select-role':
					const selectRoleType = options.getString('type');
					const selectRoleRole = options.getRole('role');
					const selectRoleDescription = options.getString('description');
					const selectRoleEmoji = options.getString('emoji');
					const selectRoleMessageID = options.getString('messageid');
					const selectRoleTitle = options.getString('title');

					var selectRoleMessage;
					if (selectRoleMessageID) {
						// search for message
						selectRoleMessage =
							await channel.messages.fetch(selectRoleMessageID);
						if (!selectRoleMessage)
							return await sendEmbed(
								interaction,
								'Please provide a valid message id'
							);
					}

					switch (selectRoleType) {
						case 'add':
							if (!selectRoleMessageID) {
								// get guild data
								const guildData = await GuildSelectRoles.find({
									guildId: guild.id,
								});

								// premium check
								const premiumRole = client.guilds.cache
									.get(DeveloperGuildID)
									.roles.cache.get(PremiumUserRoleID);

								const hasPremiumRole = premiumRole.members.has(user.id)
									? true
									: false;

								if (guildData?.length !== 0) {
									// check if the guild has a select menu in the guild

									// loop through guild data
									for (var i = 0; i < guildData.length; i++) {
										// get channel
										const targetChannel =
											guild.channels.cache.get(guildData[i].channelId) ||
											(await guild.channels
												.fetch(guildData[i].channelId)
												.catch(async (error) => {}));

										if (!targetChannel) {
											// delete old from database
											console.log('Channel check failed');
											await GuildSelectRoles.findOneAndDelete({
												guildId: guild.id,
												channelId: guildData[i].channelId,
											});
										}

										// get message in channel
										const targetMessage =
											targetChannel.messages.cache.get(
												guildData[i].messageId
											) ||
											(await targetChannel.messages
												.fetch(guildData[i].messageId)
												.catch(async (error) => {}));

										if (!targetMessage) {
											// delete old from database
											console.log('Message check failed');
											await GuildSelectRoles.findOneAndDelete({
												guildId: guild.id,
												messageId: guildData[i].messageId,
											});
											await sendEmbed(
												interaction,
												`Old Select Menu ${
													i + 1
												} was not found, it has been removed from the database`
											);
										}
									}
								}

								if (guildData.length >= 1 && !hasPremiumRole)
									return await sendEmbed(
										interaction,
										`You can only have 1 select menu per guild, if you would like more consider becoming a premium user! if you would like to create a new one you can delete your old one to start again [Jump to message](https://discord.com/channels/${guild.id}/${guildData[0].channelId}/${guildData[0].messageId})`
									);

								// send message
								selectRoleMessage = await channel
									.send({
										embeds: [
											new EmbedBuilder()
												.setColor(EmbedColour)
												.setDescription(`**${selectRoleTitle}**`),
										],
									})
									.catch(async (error) => {
										console.log(error);
										return await sendEmbed(
											interaction,
											'Please provide a valid message id | i cannot send messages in this channel'
										);
									});

								if (!selectRoleMessage)
									return await sendEmbed(interaction, 'something went wrong');

								// add message to database
								await GuildSelectRoles.create({
									guildId: guild.id,
									messageId: selectRoleMessage.id,
									channelId: channel.id,
									data: [
										{
											roleId: selectRoleRole.id,
											roleName: selectRoleRole.name,
											roleDescription: selectRoleDescription,
											roleEmoji: selectRoleEmoji,
										},
									],
								}).catch((error) => console.log(error));

								// role select menu
								const roleMenu = new StringSelectMenuBuilder()
									.setCustomId(`select-role.${selectRoleMessage.id}`)
									.setPlaceholder('Select a role')
									.addOptions([
										{
											label: selectRoleRole.name,
											value: selectRoleRole.id,
											description: selectRoleDescription,
											emoji: selectRoleEmoji,
										},
									]);

								const actionRow = new ActionRowBuilder().addComponents(
									roleMenu
								);

								await selectRoleMessage.edit({
									content: '',
									components: [actionRow],
								});

								return await sendEmbed(
									interaction,
									`Added ${selectRoleRole} to the select menu`
								);
							} else {
								// get data from database
								const data = await GuildSelectRoles.findOne({
									messageId: selectRoleMessageID,
								});

								if (!data)
									return await sendEmbed(
										interaction,
										'Please provide a valid message id'
									);

								console.log(data);

								if (data.data.length >= 25)
									return await sendEmbed(
										interaction,
										'You can only have 25 roles in a select menu'
									);

								if (data.data.some((r) => r.roleId === selectRoleRole.id))
									return await sendEmbed(
										interaction,
										'This role is already in the select menu'
									);

								// add role to database
								data.data.push({
									roleId: selectRoleRole.id,
									roleName: selectRoleRole.name,
									roleDescription: selectRoleDescription,
									roleEmoji: selectRoleEmoji,
								});

								await data.save().catch((error) => console.log(error));

								const selectRoleMenu = new StringSelectMenuBuilder()
									.setCustomId(`select-role.${selectRoleMessage.id}`)
									.setPlaceholder('Select a role')
									.setMaxValues(data.data.length)
									.setMinValues(0)
									.addOptions(
										data.data.map((r) => {
											return {
												label: r.roleName,
												value: r.roleId,
												description: r.roleDescription,
												emoji: r.roleEmoji,
											};
										})
									);

								const actionRow = new ActionRowBuilder().addComponents(
									selectRoleMenu
								);

								await selectRoleMessage.edit({
									components: [actionRow],
								});

								return await sendEmbed(
									interaction,
									`Added ${selectRoleRole} to the select menu`
								);
							}
							break;
						case 'remove':
							if (!selectRoleMessageID) {
								return await sendEmbed(
									interaction,
									'Please provide a message id'
								);
							}

							// get data from database
							const data = await GuildSelectRoles.findOne({
								messageId: selectRoleMessageID,
							});

							if (!data)
								return await sendEmbed(
									interaction,
									'Please provide a valid message id'
								);

							if (data.data.length >= 25)
								return await sendEmbed(
									interaction,
									'You can only have 25 roles in a select menu'
								);

							if (data.data.some((r) => r.roleId !== selectRoleRole.id)) {
								// delete old message
								await selectRoleMessage.delete();

								return await sendEmbed(
									interaction,
									'This role is not in the select menu'
								);
							}

							// remove role from database
							data.data = data.data.filter(
								(r) => r.roleId !== selectRoleRole.id
							);

							await data.save().catch((error) => console.log(error));

							if (data.data.length === 0) {
								await GuildSelectRoles.findOneAndDelete({
									messageId: selectRoleMessageID,
								});

								// fetch message and delete
								await selectRoleMessage.delete();

								return await sendEmbed(
									interaction,
									'There are no roles left in the select menu'
								);
							}

							const selectRoleMenu = new StringSelectMenuBuilder()
								.setCustomId('select-role')
								.setPlaceholder('Select a role')
								.addOptions(
									data.data.map((r) => {
										return {
											label: r.roleName,
											value: r.roleId,
											description: r.roleDescription,
											emoji: r.roleEmoji,
										};
									})
								);

							const actionRow = new ActionRowBuilder().addComponents(
								selectRoleMenu
							);

							await selectRoleMessage.edit({
								embeds: [
									new EmbedBuilder()
										.setColor(EmbedColour)
										.setDescription(
											`Selectable Roles: \`${data.data.length}\` | Max Roles: \`25\``
										),
								],
								components: [actionRow],
							});

							return await sendEmbed(
								interaction,
								`Added ${selectRoleRole} to the select menu`
							);

							break;
						default:
							return await sendEmbed(
								interaction,
								'Please provide a valid type'
							);
					}
					break;

				case 'level-rewards':
					const levelRewardsRole = options.getRole('role');
					const levelRewardsLevel = options.getInteger('level');
					const levelRewardsType = options.getString('type');

					const premiumRole = client.guilds.cache
						.get(DeveloperGuildID)
						.roles.cache.get(PremiumUserRoleID);

					const hasPremiumRole = premiumRole.members.has(user.id)
						? true
						: false;

					if (levelRewardsType === 'remove') {
						const data = await GuildLevelRewards.findOne({
							guildId: guild.id,
						});

						if (!data)
							return await sendEmbed(
								interaction,
								'There are no level rewards setup for this guild'
							);

						if (levelRewardsRole) {
							if (!data.rewards.some((r) => r.role === levelRewardsRole.id)) {
								return await sendEmbed(
									interaction,
									'There are no level rewards setup for this role'
								);
							}
							data.rewards = data.rewards.filter(
								(r) => r.role !== levelRewardsRole.id
							);
						}

						await data.save().catch((error) => console.log(error));

						return await sendEmbed(
							interaction,
							`Removed ${levelRewardsRole} from the level rewards`
						);
					}

					if (!levelRewardsLevel) {
						return await sendEmbed(
							interaction,
							'Please provide a level between 1 and 100'
						);
					}

					if (levelRewardsLevel < 1 || levelRewardsLevel > 100)
						return await sendEmbed(
							interaction,
							'Please provide a level between 1 and 100'
						);

					const data = await GuildLevelRewards.findOne({
						guildId: guild.id,
					});

					if (data) {
						if (data.rewards.length >= 5 && !hasPremiumRole)
							return await sendEmbed(
								interaction,
								'You can only have 5 level rewards, please remove one to add another or consider becoming a premium user to get double the amount of levels rewards'
							);

						if (data.rewards.length >= 10 && hasPremiumRole)
							return await sendEmbed(
								interaction,
								'You can have 10 level rewards with user premium, please remove one to add another'
							);

						if (data.rewards.some((r) => r.level === levelRewardsLevel))
							return await sendEmbed(
								interaction,
								`You already have a level reward for the level : ${levelRewardsLevel}`
							);

						if (data.rewards.some((r) => r.role === levelRewardsRole.id))
							return await sendEmbed(
								interaction,
								`You already have a level reward for the role : ${levelRewardsRole}`
							);
					}

					// Check if role is above the bot
					if (
						levelRewardsRole.position >= guild.members.me.roles.highest.position
					)
						return await sendEmbed(
							interaction,
							'Bot Missing Permissions: `RoleHierarchy`'
						);

					if (!data) {
						await GuildLevelRewards.create({
							guildId: guild.id,
							rewards: [
								{
									role: levelRewardsRole.id,
									level: levelRewardsLevel,
								},
							],
						}).catch((error) => console.log(error));
					} else {
						data.rewards.push({
							role: levelRewardsRole.id,
							level: levelRewardsLevel,
						});
						await data.save().catch((error) => console.log(error));
					}

					return await sendEmbed(
						interaction,
						`Added ${levelRewardsRole} to the level rewards for level ${levelRewardsLevel}`
					);

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
						'EmbedLinks',
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
						'EmbedLinks',
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

					console.log('Tickets channel created');

					const ticketEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle(`${guild.name} | Tickets`)
						.setDescription(
							'Welcome to our ticket channel. If you would like to talk to a staff member for assistance, please click the button below.'
						);

					const LinkButton = new ButtonBuilder()
						.setStyle(ButtonStyle.Primary)
						.setLabel('Create Ticket')
						.setCustomId('ovx-ticket');

					const row = new ActionRowBuilder().addComponents(LinkButton);

					await ticketsChannel.send({
						embeds: [ticketEmbed],
						components: [row],
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

				case 'basics':
					const basicsType = options.getString('type');
					const basicsChannel = options.getChannel('channel');

					switch (basicsType) {
						case 'suggestions':
							let guildConfiguration = await GuildSuggestionsChannels.findOne({
								guildId: guild.id,
							});

							if (!guildConfiguration) {
								guildConfiguration = await GuildSuggestionsChannels.create({
									guildId: guild.id,
								});
							}

							if (
								guildConfiguration.suggestionChannelIds.includes(
									basicsChannel.id
								)
							) {
								// Remove channel from array
								guildConfiguration.suggestionChannelIds.filter(
									(channel) => channel !== basicsChannel.id
								);
								await guildConfiguration.save();

								return await sendEmbed(
									interaction,
									`Removed ${basicsChannel} from suggestions channels`
								);
							}

							guildConfiguration.suggestionChannelIds.push(basicsChannel.id);
							await guildConfiguration.save();

							await sendEmbed(
								interaction,
								`Added ${basicsChannel} to suggestions channels`
							);

							break;

						case 'polls':
							let guildPollConfiguration = await GuildPollChannels.findOne({
								guildId: guild.id,
							});

							if (!guildPollConfiguration) {
								guildPollConfiguration = await GuildPollChannels.create({
									guildId: guild.id,
								});
							}

							if (
								guildPollConfiguration.pollChannelIds.includes(basicsChannel.id)
							) {
								// Remove channel from array
								guildPollConfiguration.pollChannelIds.filter(
									(channel) => channel !== basicsChannel.id
								);
								await guildPollConfiguration.save();

								return await sendEmbed(
									interaction,
									`Removed ${basicsChannel} from poll channels`
								);
							}

							guildPollConfiguration.pollChannelIds.push(basicsChannel.id);
							await guildPollConfiguration.save();

							await sendEmbed(
								interaction,
								`Added ${basicsChannel} to poll channels`
							);

							break;
						default:
							break;
					}

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
									.addFields({
										name: '• Channel •',
										value: `${ServerLogsChannel}`,
									})
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
									.addFields({
										name: '• Channel •',
										value: `${VoiceLogsChannel}`,
									})
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
					break

				case 'xp-booster':
					const xpBoosterRole = options.getRole('role');
					const xpBoosterPercentage = options.getInteger('percentage');

					if (xpBoosterPercentage < 1 || xpBoosterPercentage > 100) return await sendEmbed( interaction, 'Please provide a percentage between 1 and 100');
					
					const xpBoosterData = await GuildXPBoosters.findOne({
						guildId: guild.id,
					});

					if(xpBoosterData){
						if(xpBoosterData.guildData.length >= 5) return await sendEmbed(interaction, 'You can only have 5 xp boosters per guild')
						if(xpBoosterData.guildData.some((r) => r.roleId === xpBoosterRole.id)) {

							xpBoosterData.guildData = xpBoosterData.guildData.filter((r) => r.roleId !== xpBoosterRole.id);
							await xpBoosterData.save().catch((error) => console.log(error));
							return await sendEmbed(interaction, `Removed ${xpBoosterRole} from xp boosters`)
						}

						xpBoosterData.guildData.push({
							roleId: xpBoosterRole.id,
							percentage: xpBoosterPercentage,
						});

						await xpBoosterData.save().catch((error) => console.log(error));

						return await sendEmbed(interaction, `Added ${xpBoosterRole} to the xp boosters`)
					}  else {
						await GuildXPBoosters.create({
							guildId: guild.id,
							guildData: [
								{
									roleId: xpBoosterRole.id,
									percentage: xpBoosterPercentage,
								},
							],
						}).catch((error) => console.log(error));
					}
				
					break;


				default:
					break;
			}
		} catch (error) {}
	},
};
