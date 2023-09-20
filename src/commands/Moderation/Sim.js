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
		.setName('sim')
		.setDescription('Simulate a joining/leaving a guild.')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false)
		.addStringOption((option) =>
			option
				.setName('choice')
				.setDescription('Leave or join the guild.')
				.setRequired(true)
				.addChoices(
					{ name: 'Join', value: 'join' },
					{ name: 'Leave', value: 'leave' }
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

			// User permissions
			const userPermissionsArry = ['Administrator'];
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

			await sendEmbed(
				interaction,
				'Simulating a user joining/leaving the guild'
			);
			await sleep(2000);

			// Variables
			const choice = options.getString('choice');

			// Switch statement
			switch (choice) {
				case 'join':
					// Emitting the guildMemberAdd event
					client.emit('guildMemberAdd', member);
					return sendEmbed(interaction, 'Simulated a user joining the guild');
				case 'leave':
					// Emitting the guildMemberRemove event
					client.emit('guildMemberRemove', member);
					return sendEmbed(interaction, 'Simulated a user leaving the guild');
				default:
					return sendEmbed(interaction, 'Invalid choice');
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
