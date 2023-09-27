const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	parseEmoji,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
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
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription(
			'Generate a invite to the support server or the bot to your server.'
		)
		.setDMPermission(true),

	/**
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		// Deconstructing interaction
		const { client } = interaction;
		const { id: ClientID } = client.user;

		await sendEmbed(interaction, 'Generating Invite');
		await sleep(2000);

		// Variables

		// Buttons
		var LinkButton;
		if (DeveloperMode == 'true') {
			LinkButton = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setStyle(ButtonStyle.Link)
					.setLabel('Support Server')
					.setURL('https://discord.gg/uPGkcXyNZ3'),
				new ButtonBuilder()
					.setStyle(ButtonStyle.Link)
					.setLabel('Invite Bot')
					.setURL(
						`https://discord.com/api/oauth2/authorize?client_id=${ClientID}&permissions=9898960465063&scope=bot`
					)
					.setDisabled(true)
			);
		} else {
			LinkButton = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setStyle(ButtonStyle.Link)
					.setLabel('Support Server')
					.setURL('https://discord.gg/uPGkcXyNZ3'),
				new ButtonBuilder()
					.setStyle(ButtonStyle.Link)
					.setLabel('Invite Bot')
					.setURL(
						`https://discord.com/api/oauth2/authorize?client_id=${ClientID}&permissions=9898960465063&scope=bot`
					)
			);
		}

		// Embed
		const InviteEmbed = new EmbedBuilder()
			.setColor(EmbedColour)
			.setDescription(
				'• Click the buttons below to join the support server or invite the bot to your server! •'
			)
			.setTimestamp()
			.setFooter({ text: FooterText, iconURL: FooterImage });
		interaction.editReply({
			embeds: [InviteEmbed],
			components: [LinkButton],
		});
	},
};
