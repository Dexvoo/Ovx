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
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
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
		.setName('avatar')
		.setDescription('Sets your AFK status.')
		.setDMPermission(false)
		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('The user you would like to get the avatar of.')
				.setRequired(true)
		),

	/**
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		// Deconstructing interaction
		const { guild, member, options, user, client, channel } = interaction;

		await sendEmbed(interaction, 'Preparing avatar');
		await sleep(2000);

		// Checking if the user is in a guild
		if (!(await guildCheck(guild))) return;

		// Variables
		const userInformation = options.getMember('user');

		// Checking If The User Is Valid
		if (!userInformation) {
			return await sendEmbed(interaction, 'Please specify a valid user.');
		}

		// Buttons
		const LinkButton = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setStyle(ButtonStyle.Link)
				.setLabel('PNG')
				.setURL(
					userInformation.user.displayAvatarURL({
						size: 1024,
						extension: 'png',
					})
				),
			new ButtonBuilder()
				.setStyle(ButtonStyle.Link)
				.setLabel('JPG')
				.setURL(
					userInformation.user.displayAvatarURL({
						size: 1024,
						extension: 'jpg',
					})
				),
			new ButtonBuilder()
				.setStyle(ButtonStyle.Link)
				.setLabel('GIF')
				.setURL(
					userInformation.user.displayAvatarURL({
						dynamic: true,
						size: 1024,
					})
				)
		);

		// sends embed
		const Embed = new EmbedBuilder()
			.setColor(EmbedColour)
			.setAuthor({
				name: `@${userInformation.user.username}'s Avatar`,
				iconURL: userInformation.user.displayAvatarURL({ dynamic: true }),
			})
			.setImage(
				userInformation.user.displayAvatarURL({ dynamic: true, size: 4096 })
			)
			.setTimestamp()
			.setFooter({ text: FooterText, iconURL: FooterImage });
		interaction.editReply({
			embeds: [Embed],
			components: [LinkButton],
		});
	},
};
