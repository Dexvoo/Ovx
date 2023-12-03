const {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	Interaction,
	ButtonStyle,
} = require('discord.js');
const { FooterImage, EmbedColour } = process.env;

module.exports = {
	cooldown: 5,
	catagory: 'Miscellaneous',
	data: new SlashCommandBuilder()
		.setName('vote')
		.setDescription('Vote for the bot!'),

	/**
	 *  @param {Interaction} interaction
	 */
	async execute(interaction) {
		const { client } = interaction;

		// button
		const button = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setLabel('Vote')
				.setStyle(ButtonStyle.Link)
				.setURL(`https://top.gg/bot/${client.user.id}/vote`)
		);

		const embed = new EmbedBuilder()
			.setTitle('Vote for the bot!')
			.setDescription('You can vote for the bot on top.gg!')
			.setColor(EmbedColour)
			.setTimestamp()
			.setFooter({ text: 'Made with ❤️ by @dexvo', iconURL: FooterImage });

		await interaction.reply({
			embeds: [embed],
			components: [button],
		});
	},
};
