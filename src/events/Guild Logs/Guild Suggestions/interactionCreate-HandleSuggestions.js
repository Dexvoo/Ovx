const {
	EmbedBuilder,
	Events,
	Guild,
	AuditLogEvent,
	CommandInteraction,
	Interaction,
	ChannelType,
	PermissionFlagsBits,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	PermissionsBitField,
} = require('discord.js');
const { FooterText, FooterImage, EmbedColour } = process.env;
const GuildSuggestionMessages = require('../../../models/GuildSuggestionMessages.js');
const ticketSetup = require('../../../models/GuildTicketsSetup.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { permissionCheck } = require('../../../utils/Checks.js');
const formatResults = require('../../../utils/formatSuggestionResults.js');

module.exports = {
	name: Events.InteractionCreate,
	nickname: 'Suggestions',
	once: false,

	/**
	 * @param {Interaction} interaction
	 */

	async execute(interaction) {
		// deconstructing interaction
		const { guild, client, customId, member, channel, user } = interaction;

		if (!interaction.isButton() || !customId) return;
		console.log(`CustomId: ${customId}`);

		try {
			const [type, suggestionId, action] = customId.split('.');

			if (!type || !suggestionId || !action) return;
			if (type !== 'suggestion') return;

			await interaction.deferReply({ ephemeral: true });

			const targetSuggestion = await GuildSuggestionMessages.findOne({
				suggestionId,
			});
			const targetMessage = await channel.messages.fetch(
				targetSuggestion.messageId
			);
			const targetMessageEmbed = targetMessage.embeds[0];

			const currentTime = `<t:${Math.floor(Date.now() / 1000)}:R>`;

			if (action === 'approve') {
				if (!interaction.memberPermissions.has('Administrator')) {
					return await interaction.editReply({
						content: 'Only administrators can approve/deny suggestions.',
					});
				}

				console.log('Approving suggestion');
				targetSuggestion.status = 'approved';

				targetMessageEmbed.data.color = 0x84e660;
				targetMessageEmbed.fields[1].value = 'Approved';
				targetMessageEmbed.fields[3].value = currentTime;
				console.log('currentTime', currentTime);
				await targetSuggestion.save();
				console.log('targetSuggestion saving', targetSuggestion);

				await interaction.editReply({ content: 'Suggestion approved.' });
				await targetMessage.edit({
					embeds: [targetMessageEmbed],
					components: [targetMessage.components[0]],
				});

				// save suggestion to ticket setup
				return;
			}

			if (action === 'deny') {
				if (!interaction.memberPermissions.has('Administrator')) {
					return await interaction.editReply({
						content: 'Only administrators can approve/deny suggestions.',
					});
				}

				targetSuggestion.status = 'Denied';

				targetMessageEmbed.data.color = 0xff6161;
				targetMessageEmbed.fields[1].value = 'Denied';
				targetMessageEmbed.fields[3].value = currentTime;

				await targetSuggestion.save();

				await interaction.editReply({ content: 'Suggestion denied.' });
				await targetMessage.edit({
					embeds: [targetMessageEmbed],
					components: [targetMessage.components[0]],
				});
				return;
			}

			const hasVoted =
				targetSuggestion.upvotes.includes(interaction.user.id) ||
				targetSuggestion.downvotes.includes(interaction.user.id);
			if (hasVoted) {
				const Embed = new EmbedBuilder()
					.setColor(EmbedColour)
					.setDescription('You have already voted on this suggestion.')
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
				interaction.editReply({ embeds: [Embed] });
				return;
			}

			if (action === 'upvote') {
				targetSuggestion.upvotes.push(user.id);
				targetMessageEmbed.fields[3].value = currentTime;
				targetMessageEmbed.fields[4].value = formatResults(
					targetSuggestion.upvotes,
					targetSuggestion.downvotes
				);

				await targetSuggestion.save();
				await interaction.editReply({ content: 'Upvoted.' });
				await targetMessage.edit({
					embeds: [targetMessageEmbed],
				});
				return;
			}

			if (action === 'downvote') {
				targetSuggestion.downvotes.push(user.id);
				targetMessageEmbed.fields[3].value = currentTime;
				targetMessageEmbed.fields[4].value = formatResults(
					targetSuggestion.upvotes,
					targetSuggestion.downvotes
				);
				await targetSuggestion.save();
				await interaction.editReply({ content: 'Downvoted.' });
				await targetMessage.edit({
					embeds: [targetMessageEmbed],
				});
				return;
			}
		} catch (error) {
			console.log(error);
		}
	},
};
