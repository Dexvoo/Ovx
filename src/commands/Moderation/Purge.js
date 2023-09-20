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

module.exports = {
	data: new SlashCommandBuilder()
		.setName('purge')
		.setDescription('Delete a certain amount of messages.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.setDMPermission(false)
		.addIntegerOption((option) =>
			option
				.setName('amount')
				.setDescription('The amount of messages you would like to delete.')
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
			const botPermissionsArry = ['ManageMessages', 'ViewChannel'];
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
			const userPermissionsArry = ['ManageMessages'];
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

			// Variables
			const amount = options.getInteger('amount');

			// Checking if the amount is valid
			if (amount < 1 || amount > 100)
				return await sendEmbed(
					interaction,
					'Please provide a number between 1 and 100'
				);

			// Deleting messages
			const messagesDeleted = await channel
				.bulkDelete(amount, true)
				.catch((error) => {
					console.error(error);
					return sendErrorEmbed(interaction, error);
				});

			// Sending embed
			await sendEmbed(interaction, `Deleted ${messagesDeleted.size} messages`);
			await sleep(5000);

			// fetch reply message
			const reply = await interaction.fetchReply().catch(() => {
				return false;
			});

			if (reply) await reply.delete();
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
