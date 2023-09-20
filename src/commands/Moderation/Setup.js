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
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const { FooterText, FooterImage, EmbedColour } = process.env;
const welcomeMessagesSchema = require('../../models/WelcomeMessages.js');
// const levelNotificationsSchema = require('../../models/LevelNotifications.js');
// const inviteTrackerSchema = require('../../models/InviteTracker.js');
// const ChannelLogs = require('../../models/GuildChannelLogs.js');
// const MemberLogs = require('../../models/GuildMemberLogs.js');
// const RoleLogs = require('../../models/GuildRoleLogs.js');
// const JoinLeaveLogs = require('../../models/GuildJoinLeaveLogs.js');
// const MessageLogs = require('../../models/GuildMessageLogs.js');
// const BlacklistedChannels = require('../../models/GuildBlacklistedChannels.js');

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
		),
	/**
	 * @param {CommandInteraction} interaction
	 */
	async execute(interaction) {
		try {
			// Deconstructing interaction
			const { guild, member, options, user, client, channel } = interaction;

			// Checking if the user is in a guild
			if (!(await guildCheck(interaction))) return;

			// Bot permissions
			const botPermissionsArry = ['ManageMessages'];
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
			const userPermissionsArry = ['Administrator', 'ManageRoles'];
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

				default:
					break;
			}
		} catch (error) {}
	},
};
