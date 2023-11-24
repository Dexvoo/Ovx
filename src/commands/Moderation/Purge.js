const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
	CommandInteraction,
	IntentsBitField,
	PermissionsBitField,
} = require('discord.js');

const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const MessageLogs = require('../../models/GuildMessageLogs.js');
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
				.setRequired(false)
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

			if (!botPermissions[0]) {
				await sendEmbed(
					interaction,
					`Bot Missing Permissions: \`${botPermissions[1]}\``
				);
				return;
			}

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
			var amount = options.getInteger('amount');
			if (!amount) amount = 100;

			// Checking if the amount is valid
			if (amount < 1 || amount > 100)
				return await sendEmbed(
					interaction,
					'Please provide a number between 1 and 100'
				);

			// Deleting messages
			const messagesDeleted = await channel
				.bulkDelete(amount, true)
				.catch(async (error) => {
					console.error(error);

					console.log(`what permissions does the bot have?`);
					console.log(`permissions2222: ${botPermissions[1].join(', ')}`);

					await sendEmbed(interaction, `There was an error deleting messages`);
					return;
				});

			if (!messagesDeleted)
				return await sendEmbed(interaction, `No messages were deleted`);

			// Sending embed
			await sendEmbed(
				interaction,
				`Deleted ${messagesDeleted.size || 0} messages`
			);
			await sleep(5000);

			// fetch reply message
			const reply = await interaction.fetchReply().catch(() => {
				return false;
			});

			if (reply) await reply.delete();

			// Fetching message logs
			const MessageLogsData = await MessageLogs.findOne({
				guild: guild.id,
			});

			// Checking if the guild has a message logs set up
			if (!MessageLogsData) return;

			// Getting guild channel
			const channelToSend = guild.channels.cache.get(MessageLogsData.channel);

			// Check if the channel exists
			if (!channelToSend) {
				await MessageLogs.findOneAndDelete({ guildId: guild.id });
				await sendEmbed(
					await guild.fetchOwner(),
					`Message Logs channel was deleted or changed | Message Logs is now \`disabled\``
				);
				return;
			}

			// Bot permissions
			const botPermissionsArry2 = ['SendMessages', 'ViewChannel'];
			const botPermissions2 = await permissionCheck(
				channelToSend,
				botPermissionsArry2,
				client
			);

			// Checking if the bot has permissions
			if (!botPermissions2[0]) {
				await MessageLogs.findOneAndDelete({ guildId: guild.id });
				return await sendEmbed(
					await guild.fetchOwner(),
					`Bot Missing Permissions: \`${botPermissions2[1]}\` in channel : ${channelToSend} | Message Logs is now \`disabled\``
				);
			}

			// Sending embed
			await sendEmbed(channelToSend, `${member} Used the /purge in ${channel}`);
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
