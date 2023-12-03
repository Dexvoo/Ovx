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
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const SuggestionMessages = require('../../models/GuildSuggestionMessages.js');
const SuggestionChannels = require('../../models/GuildSuggestionChannels.js');
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
		.setName('suggest')
		.setDescription('Create a suggestion.')
		.setDMPermission(false),

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

			// Variables
			const guildConfiguration = await SuggestionChannels.findOne({
				guildId: guild.id,
			});

			if (!guildConfiguration) {
				await sendEmbed(
					interaction,
					'This server does not have a suggestion channel set up. Please ask a admin to run the command /setup basics suggestions'
				);
				return;
			}

			if (!guildConfiguration.suggestionChannelIds.length) {
				await sendEmbed(
					interaction,
					'This server does not have a suggestion channel set up. Please ask a admin to run the command /setup basics suggestions'
				);
				return;
			}

			if (!guildConfiguration.suggestionChannelIds.includes(channel.id)) {
				await sendEmbed(
					interaction,
					'This channel is not a suggestion channel. Please try one of these channels: ' +
						guildConfiguration.suggestionChannelIds
							.map((channelId) => `<#${channelId}>`)
							.join(', ')
				);
				return;
			}

			const modal = new ModalBuilder()
				.setTitle('Create A Suggestion')
				.setCustomId(`suggestion-${user.id}`);

			const textInput = new TextInputBuilder()
				.setCustomId('suggestion-input')
				.setLabel('What would you like to suggest?')
				.setStyle(TextInputStyle.Paragraph)
				.setRequired(true)
				.setMaxLength(1000);

			const actionRow = new ActionRowBuilder().addComponents(textInput);

			modal.addComponents(actionRow);

			await interaction.showModal(modal, actionRow);
			// below will only run if the user submits the modal

			const filter = (i) => i.customId === `suggestion-${user.id}`;
			const modalInteraction = await interaction
				.awaitModalSubmit({
					filter,
					time: 1000 * 60 * 5,
				})
				.catch((error) => {
					console.log(`Suggestion Has Expired: ${error}`);
				});

			if (!modalInteraction) {
				await interaction.followUp({
					content: 'Suggestion has expired.',
					ephemeral: true,
				});
				return;
			}

			await modalInteraction.deferReply({ ephemeral: true });

			let SuggestionMessage;

			try {
				SuggestionMessage = await channel.send(
					'Creating suggestion, Please wait...'
				);
			} catch (error) {
				modalInteraction.editReply(
					'There was an error creating your suggestion, I may not have enough permissions.'
				);
				return;
			}

			// get suggestion text from modal reply
			const suggestionText =
				modalInteraction.fields.getTextInputValue('suggestion-input');

			const newSuggestion = new SuggestionMessages({
				authorId: user.id,
				guildId: guild.id,
				messageId: SuggestionMessage.id,
				content: suggestionText,
			});

			await newSuggestion.save();

			modalInteraction.editReply('Suggestion Created!');

			// Suggestion Embed

			const suggestionEmbed = new EmbedBuilder()
				.setAuthor({
					name: `@${user.username}`,
					iconURL: user.displayAvatarURL({ size: 256 }),
				})
				.addFields(
					{
						name: 'Suggestion',
						value: suggestionText,
					},
					{
						name: 'Status',
						value: 'Pending',
					},
					{
						name: 'Created',
						value: `<t:${Math.floor(newSuggestion.createdAt / 1000)}:R>`,
						inline: true,
					},
					{
						name: 'Last Updated',
						value: `<t:${Math.floor(newSuggestion.updatedAt / 1000)}:R>`,
						inline: true,
					},
					{
						name: 'Votes',
						value: formatResults(),
					}
				)
				.setColor('Yellow');

			// Buttons

			const upvoteButton = new ButtonBuilder()
				.setEmoji('👍')
				.setLabel('Upvote')
				.setStyle(ButtonStyle.Primary)
				.setCustomId(`suggestion.${newSuggestion.suggestionId}.upvote`);

			const downvoteButton = new ButtonBuilder()
				.setEmoji('👎')
				.setLabel('Downvote')
				.setStyle(ButtonStyle.Primary)
				.setCustomId(`suggestion.${newSuggestion.suggestionId}.downvote`);

			const approveButton = new ButtonBuilder()
				.setEmoji('✅')
				.setLabel('Approve')
				.setStyle(ButtonStyle.Success)
				.setCustomId(`suggestion.${newSuggestion.suggestionId}.approve`);

			const denyButton = new ButtonBuilder()
				.setEmoji('❌')
				.setLabel('Deny')
				.setStyle(ButtonStyle.Danger)
				.setCustomId(`suggestion.${newSuggestion.suggestionId}.deny`);

			// Rows

			const firstRow = new ActionRowBuilder().addComponents(
				upvoteButton,
				downvoteButton
			);
			const secondRow = new ActionRowBuilder().addComponents(
				approveButton,
				denyButton
			);

			SuggestionMessage.edit({
				content: '',
				embeds: [suggestionEmbed],
				components: [firstRow, secondRow],
			});
		} catch (error) {
			console.log(error);
		}
	},
};
