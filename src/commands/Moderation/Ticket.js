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
	data: new SlashCommandBuilder()
		.setName('ticket')
		.setDescription('Ticket Actions')
		.setDMPermission(false)
		.addStringOption((option) =>
			option
				.setName('action')
				.setDescription('Add or remove a member from a ticket')
				.setRequired(true)
				.addChoices(
					{ name: 'Add', value: 'add' },
					{ name: 'Remove', value: 'remove' }
				)
		)
		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('The user to add or remove')
				.setRequired(true)
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
			const botPermissionsArry = ['ManageRoles', 'ManageChannels'];
			const botPermissions = await permissionCheck(
				interaction,
				botPermissionsArry,
				client
			);

			if (!botPermissions[0]) {
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
			const action = options.getString('action');
			const targetUser = options.getUser('user');
			const targetMember = await guild.members.fetch(targetUser);

			if (targetMember.id === client.user.id) {
				return await sendEmbed(
					interaction,
					'You cannot add or remove the bot from a ticket'
				);
			}

			if (targetMember.id === interaction.member.id) {
				return await sendEmbed(
					interaction,
					'You cannot add or remove yourself from a ticket'
				);
			}

			if (targetMember.manageable === false) {
				return await sendEmbed(
					interaction,
					'I cannot add or remove this user from a ticket'
				);
			}

			switch (action) {
				case 'add':
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

					channel.permissionOverwrites.create(targetMember.id, {
						SendMessages: true,
						ViewChannel: true,
						ReadMessageHistory: true,
					});

					await sendEmbed(interaction, `Added ${targetMember} to the ticket`);

					break;
				case 'remove':
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

					channel.permissionOverwrites.create(targetMember.id, {
						SendMessages: false,
						ViewChannel: false,
						ReadMessageHistory: false,
					});

					await sendEmbed(
						interaction,
						`Removed ${targetMember} from the ticket`
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
