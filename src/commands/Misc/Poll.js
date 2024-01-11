const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	parseEmoji,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	ChatInputCommandInteraction,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const PollMessages = require('../../models/GuildPollMessages.js');
const PollChannels = require('../../models/GuildPollChannels.js');
const e = require('express');
const formatResults = require('../../utils/formatSuggestionResults.js');
const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	EmbedColour,
	FooterImage,
	FooterText,
} = process.env;
require('dotenv').config();

module.exports = {
	cooldown: 5,
	catagory: 'Miscellaneous',
	data: new SlashCommandBuilder()
		.setName('poll')
		.setDescription('Create/Delete/Setup polls.')
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand.setName('create').setDescription('Create a poll.')
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('delete')
				.setDescription('Delete a poll.')
				.addStringOption((option) =>
					option
						.setName('message-id')
						.setDescription('The message id of the poll.')
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('setup')
				.setDescription('Setup polls.')
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('The channel to setup polls in.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true)
				)
		),

	/**
	 * @param {ChatInputCommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		// Deconstructing interaction
		try {
			const { guild, member, options, user, client, channel } = interaction;

			// Checking if the user is in a guild
			if (!(await guildCheck(guild))) return;

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

			switch (options.getSubcommand()) {
				case 'create':
					// Variables
					const guildConfiguration = await PollChannels.findOne({
						guildId: guild.id,
					});

					if (!guildConfiguration?.pollChannelIds.length) {
						await sendEmbed(
							interaction,
							'This server does not have a poll channel set up. Please ask a admin to run the command /setup basics poll'
						);
						return;
					}

					// loop through guildConfiguration?.pollChannelIds and make sure the channel exists or fetch it
					for (const channelId of guildConfiguration?.pollChannelIds) {
						// fetch channel
						if (
							!guild.channels.cache.has(channelId) ||
							!(await guild.channels.fetch(channelId).catch(() => {}))
						) {
							// remove channel from guildConfiguration?.pollChannelIds
							guildConfiguration.pollChannelIds =
								guildConfiguration.pollChannelIds.filter(
									(id) => id !== channelId
								);
							// save guildConfiguration
							await guildConfiguration.save();
						}
					}

					if (!guildConfiguration.pollChannelIds.includes(channel.id)) {
						await sendEmbed(
							interaction,
							'This channel is not a poll channel. Please try one of these channels: ' +
								guildConfiguration.pollChannelIds
									.map((channelId) => `<#${channelId}>`)
									.join(', ')
						);
						return;
					}

					const modal = new ModalBuilder()
						.setTitle('Create A Poll')
						.setCustomId(`poll-${user.id}`);

					const textInput = new TextInputBuilder()
						.setCustomId('poll-input')
						.setLabel('Infomration to start a poll')
						.setStyle(TextInputStyle.Paragraph)
						.setRequired(true)
						.setMaxLength(1000);

					const actionRow = new ActionRowBuilder().addComponents(textInput);

					modal.addComponents(actionRow);

					await interaction.showModal(modal, actionRow);
					// below will only run if the user submits the modal

					const filter = (i) => i.customId === `poll-${user.id}`;
					const modalInteraction = await interaction
						.awaitModalSubmit({
							filter,
							time: 1000 * 60 * 5,
						})
						.catch((error) => {
							console.log(`Poll Has Expired: ${error}`);
						});

					if (!modalInteraction) {
						await interaction.followUp({
							content: 'Poll has expired.',
							ephemeral: true,
						});
						return;
					}

					await modalInteraction.deferReply({ ephemeral: true });

					let PollMessage;

					try {
						PollMessage = await channel.send('Creating poll, Please wait...');
					} catch (error) {
						// Bot permissions
						const botPermissionsArry = [
							'ViewChannel',
							'SendMessages',
							'EmbedLinks',
						];
						const botPermissions = await permissionCheck(
							channel,

							botPermissionsArry,
							client
						);

						if (!botPermissions[0]) {
							modalInteraction.editReply(
								`There was an error creating your poll, permissions missing : ${botPermissions[1]}`
							);
							return false;
						}
					}

					if (!PollMessage) return;

					// get poll text from modal reply
					const pollText =
						modalInteraction.fields.getTextInputValue('poll-input');

					const newPoll = new PollMessages({
						authorId: user.id,
						guildId: guild.id,
						messageId: PollMessage.id,
						content: pollText,
					});

					await newPoll.save();

					modalInteraction.editReply('Poll Created!');

					// Poll Embed

					const pollEmbed = new EmbedBuilder()
						.setAuthor({
							name: `@${user.username}`,
							iconURL: user.displayAvatarURL({ size: 256 }),
						})
						.addFields(
							{
								name: 'Poll',
								value: pollText,
							},
							{
								name: 'Created',
								value: `<t:${Math.floor(newPoll.createdAt / 1000)}:R>`,
								inline: true,
							},
							{
								name: 'Last Updated',
								value: `<t:${Math.floor(newPoll.updatedAt / 1000)}:R>`,
								inline: true,
							},
							{
								name: 'Votes',
								value: formatResults(),
							}
						)
						.setColor(EmbedColour);

					// Buttons

					const upvoteButton = new ButtonBuilder()
						.setEmoji('👍')
						.setLabel('Upvote')
						.setStyle(ButtonStyle.Primary)
						.setCustomId(`poll.${newPoll.pollId}.upvote`);

					const downvoteButton = new ButtonBuilder()
						.setEmoji('👎')
						.setLabel('Downvote')
						.setStyle(ButtonStyle.Primary)
						.setCustomId(`poll.${newPoll.pollId}.downvote`);

					// Rows

					const firstRow = new ActionRowBuilder().addComponents(
						upvoteButton,
						downvoteButton
					);

					PollMessage.edit({
						content: '',
						embeds: [pollEmbed],
						components: [firstRow],
					});
					break;

				case 'delete':
					// Variables
					const messageId = options.getString('message-id');

					const poll = await PollMessages.findOne({
						messageId: messageId,
					});

					if (!poll) {
						await sendEmbed(interaction, 'That poll does not exist.');
						return;
					}

					if (
						member.id !== poll.authorId &&
						!member.permissions.has('Administrator')
					) {
						await sendEmbed(
							interaction,
							'Administator is required to delete other users polls.'
						);
						return;
					}

					const pollMessage = await channel.messages
						.fetch(messageId)
						.catch(() => {});

					if (!pollMessage) {
						await sendEmbed(
							interaction,
							'Could not find that poll, please run the command in the channel the poll was created in'
						);
						return;
					}

					await pollMessage.delete();

					await sendEmbed(interaction, 'Poll Deleted.');

					break;

				case 'setup':
					const pollChannel = options.getChannel('channel');
					let guildConfigurationSetup = await PollChannels.findOne({
						guildId: guild.id,
					});

					if (!guildConfigurationSetup) {
						guildConfigurationSetup = await PollChannels.create({
							guildId: guild.id,
						});
					}

					if (guildConfigurationSetup.pollChannelIds.includes(pollChannel.id)) {
						guildConfigurationSetup.pollChannelIds.filter(
							(id) => id !== pollChannel.id
						);

						await guildConfigurationSetup.save();

						return await sendEmbed(
							interaction,
							`Removed ${pollChannel} from poll channels.`
						);
					}

					guildConfigurationSetup.pollChannelIds.push(pollChannel.id);
					await guildConfigurationSetup.save();

					await sendEmbed(
						interaction,
						`Added ${pollChannel} to poll channels.`
					);

					break;
			}
		} catch (error) {
			console.log(error);
		}
	},
};
