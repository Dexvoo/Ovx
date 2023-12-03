const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
	CommandInteraction,
	ChannelType,
} = require('discord.js');

const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const GuildTicketsInfo = require('../../models/GuildTicketsInfo.js');
require('dotenv').config();
const { EmbedColour, FooterImage, FooterText } = process.env;

module.exports = {
	cooldown: 5,
	catagory: 'Moderation',
	data: new SlashCommandBuilder()
		.setName('ticket')
		.setDescription('Ticket Actions')
		.setDMPermission(false)

		.addSubcommand((subcommand) =>
			subcommand
				.setName('addmember')
				.setDescription('Add a member to a ticket')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('The member to add')
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('removemember')
				.setDescription('Remove a member from a ticket')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('The member to remove')
						.setRequired(true)
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

			// Bot permissions
			const botPermissionsArry = [
				'ViewChannel',
				'ManageRoles',
				'ManageChannels',
			];
			const botPermissions = await permissionCheck(
				interaction,
				botPermissionsArry,
				client
			);

			if (!botPermissions[0]) {
				return await sendEmbed(
					interaction,
					`Bot Missing Permissions: \`${botPermissions[1]}\``
				);
			}

			// User permissions
			const userPermissionsArry = ['BanMembers'];
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

			await sendEmbed(interaction, 'Getting ticket information');
			await sleep(2000);

			// Variables
			const subcommand = options.getSubcommand();

			switch (subcommand) {
				case 'addmember':
					const targetUserAddMember = options.getUser('member');
					const targetMemberAddMember = await guild.members
						.fetch(targetUserAddMember)
						.catch(() => {
							return false;
						});

					if (!targetMemberAddMember) {
						return await sendEmbed(
							interaction,
							'Please provide a valid user to add to the ticket'
						);
					}

					if (targetMemberAddMember.id === client.user.id) {
						return await sendEmbed(
							interaction,
							'You cannot add or remove the bot from a ticket'
						);
					}

					if (targetMemberAddMember.id === interaction.member.id) {
						return await sendEmbed(
							interaction,
							'You cannot add or remove yourself from a ticket'
						);
					}

					if (targetMemberAddMember.manageable === false) {
						return await sendEmbed(
							interaction,
							'I cannot add or remove this user from a ticket'
						);
					}
					const data = GuildTicketsInfo.findOne({
						guildid: guild.id,
						channelid: channel.id,
					});

					if (!data) {
						return await sendEmbed(
							interaction,
							'Please run this command in a ticket channel'
						);
					}

					channel.permissionOverwrites.create(targetMemberAddMember.id, {
						SendMessages: true,
						ViewChannel: true,
						ReadMessageHistory: true,
					});

					await sendEmbed(
						interaction,
						`Added ${targetMemberAddMember} to the ticket`
					);

					break;
				case 'removemember':
					const targetUserRemoveMember = options.getUser('member');
					const targetMemberRemoveMember = await guild.members
						.fetch(targetUserRemoveMember)
						.catch(() => {
							return false;
						});

					if (!targetMemberRemoveMember) {
						return await sendEmbed(
							interaction,
							'Please provide a valid user to add to the ticket'
						);
					}

					if (targetMemberRemoveMember.id === client.user.id) {
						return await sendEmbed(
							interaction,
							'You cannot add or remove the bot from a ticket'
						);
					}

					if (targetMemberRemoveMember.id === interaction.member.id) {
						return await sendEmbed(
							interaction,
							'You cannot add or remove yourself from a ticket'
						);
					}

					if (targetMemberRemoveMember.manageable === false) {
						return await sendEmbed(
							interaction,
							'I cannot add or remove this user from a ticket'
						);
					}
					const data2 = GuildTicketsInfo.findOne({
						guildid: guild.id,
						channelid: channel.id,
					});

					if (!data2) {
						return await sendEmbed(
							interaction,
							'Please run this command in a ticket channel'
						);
					}

					channel.permissionOverwrites.create(targetMemberRemoveMember.id, {
						SendMessages: false,
						ViewChannel: false,
						ReadMessageHistory: false,
					});

					await sendEmbed(
						interaction,
						`Removed ${targetMemberRemoveMember} from the ticket`
					);

					break;
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
