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
const GuildPollMessages = require('../../../models/GuildPollMessages.js');
const ticketSetup = require('../../../models/GuildTicketsSetup.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { permissionCheck } = require('../../../utils/Checks.js');
const formatResults = require('../../../utils/formatSuggestionResults.js');

module.exports = {
	name: Events.InteractionCreate,
	nickname: 'Polls',
	once: false,

	/**
	 * @param {Interaction} interaction
	 */

	async execute(interaction) {
		// deconstructing interaction
		const { guild, client, customId, member, channel, user } = interaction;

		if (!interaction.isButton() || !customId) return;

		try {
			const [type, pollId, action] = customId.split('.');

			if (!type || !pollId || !action) return;
			if (type !== 'poll') return;

			await interaction.deferReply({ ephemeral: true });

			const targetPoll = await GuildPollMessages.findOne({
				pollId,
			});
			const targetMessage = await channel.messages.fetch(targetPoll.messageId);
			const targetMessageEmbed = targetMessage.embeds[0];

			const currentTime = `<t:${Math.floor(Date.now() / 1000)}:R>`;

			const hasVoted =
				targetPoll.upvotes.includes(user.id) ||
				targetPoll.downvotes.includes(user.id);
			if (hasVoted) {
				const Embed = new EmbedBuilder()
					.setColor(EmbedColour)
					.setDescription('You have already voted on this poll.')
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
				interaction.editReply({ embeds: [Embed] });
				return;
			}

			if (action === 'upvote') {
				targetPoll.upvotes.push(user.id);
				targetMessageEmbed.fields[2].value = currentTime;
				targetMessageEmbed.fields[3].value = formatResults(
					targetPoll.upvotes,
					targetPoll.downvotes
				);

				await targetPoll.save();
				await interaction.editReply({ content: 'Upvoted.' });
				targetMessage.edit({
					embeds: [targetMessageEmbed],
				});
				return;
			}

			if (action === 'downvote') {
				targetPoll.downvotes.push(user.id);
				targetMessageEmbed.fields[2].value = currentTime;
				targetMessageEmbed.fields[3].value = formatResults(
					targetPoll.upvotes,
					targetPoll.downvotes
				);
				await targetPoll.save();
				await interaction.editReply({ content: 'Downvoted.' });
				targetMessage.edit({
					embeds: [targetMessageEmbed],
				});
				return;
			}
		} catch (error) {
			console.log(error);
		}
	},
};
