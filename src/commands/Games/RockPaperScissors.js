require('dotenv').config();
const { FooterText, FooterImage, EmbedColour, ErrorChannelID } = process.env;
const {
	SlashCommandBuilder,
	EmbedBuilder,
	CommandInteraction,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');

const choices = [
	{ name: 'Rock', emoji: '👊', beats: 'Scissors' },
	{ name: 'Paper', emoji: '✋', beats: 'Rock' },
	{ name: 'Scissors', emoji: '✌', beats: 'Paper' },
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rps')
		.setDescription('Play rock, paper, scissors.')
		.setDMPermission(false)
		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('The specified user to play with.')
				.setRequired(true)
		),

	async execute(interaction) {
		try {
			const { options, user, client } = interaction;
			const targetUser = options.getUser('user');

			// Placeholder Embed
			await sendEmbed(interaction, `Preparing Game`);
			await sleep(2000);

			// Guild Check
			if (!guildCheck(interaction)) return;

			const botPermissionsArry = ['ViewChannel', 'SendMessages'];
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

			// Provided User Check
			if (targetUser.bot) {
				return sendEmbed(interaction, 'You cannot play with a bot');
			}

			if (targetUser.id === user.id) {
				return sendEmbed(interaction, 'You cannot play with yourself');
			}

			const embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription(
					`•  ${targetUser}, you have been challenged to a game of Rock, Paper, or Scissors by ${user}. To play pick one of the buttons below •`
				)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			const Buttons = choices.map((choice) => {
				return new ButtonBuilder()
					.setCustomId(choice.name)
					.setLabel(choice.name)
					.setStyle(ButtonStyle.Primary)
					.setEmoji(choice.emoji);
			});

			const row = new ActionRowBuilder().addComponents(Buttons);

			const reply = await interaction.editReply({
				content: `${targetUser}`,
				embeds: [embed],
				components: [row],
			});

			const targetUserInteraction = await reply
				.awaitMessageComponent({
					filter: (i) => i.user.id === targetUser.id,
					time: 30_000,
				})
				.catch(async (error) => {
					const TimeoutEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(
							`• Game over, ${targetUser} did not respond in time •`
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });
					await reply.edit({ embeds: [TimeoutEmbed], components: [] });
					return;
				});

			if (!targetUserInteraction) return;

			const targetUserChoice = choices.find(
				(choice) => choice.name === targetUserInteraction.customId
			);

			await targetUserInteraction.reply({
				content: `You picked ${targetUserChoice.name} ${targetUserChoice.emoji}`,
				ephemeral: true,
			});

			embed.setDescription(`•  its currently ${user}'s turn •`);
			await reply.edit({
				content: `${user} it's your turn now `,
				embeds: [embed],
			});

			const initialUserInteraction = await reply
				.awaitMessageComponent({
					filter: (i) => i.user.id === user.id,
					time: 30_000,
				})
				.catch(async (error) => {
					const TimeoutEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(`• Game over, ${user} did not respond in time •`)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });
					await reply.edit({ embeds: [TimeoutEmbed], components: [] });
				});

			if (!initialUserInteraction) return;

			const initialUserChoice = choices.find(
				(choice) => choice.name === initialUserInteraction.customId
			);

			let result;

			if (targetUserChoice.beats === initialUserChoice.name) {
				result = `${targetUser} wins!`;
			} else if (initialUserChoice.beats === targetUserChoice.name) {
				result = `${user} wins!`;
			} else if (initialUserChoice.name === targetUserChoice.name) {
				result = `It's a tie!`;
			}

			embed.setDescription(
				`${targetUser} : ${targetUserChoice.name} ${targetUserChoice.emoji}\n${user} : ${initialUserChoice.name} ${initialUserChoice.emoji}\n\n${result}`
			);

			// Gameover, Remove Buttons and send result
			reply.edit({ content: '', embeds: [embed], components: [] });
		} catch (error) {
			console.error(error);

			return sendEmbed(
				interaction,
				`There was an error running this command\n\n${error}`
			);
		}
	},
};
