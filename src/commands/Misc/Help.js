const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
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
		.setName('help')
		.setDescription('Bot explanation')
		.setDMPermission(false),

	/**
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		// Deconstructing interaction
		const { guild, member, options, user, client, channel } = interaction;

		await sendEmbed(interaction, 'Getting help');
		await sleep(2000);

		// Checking if the user is in a guild
		if (!(await guildCheck(guild))) return;

		//

		const Embed = new EmbedBuilder()
			.setTitle(`Help`)
			.setColor(EmbedColour)
			.addFields(
				{
					name: `Commands`,
					value: `Commands are used to make the bot do things. You can find a list of commands by typing \`/information bot\``,
				},
				{
					name: 'Permissions',
					value:
						'Permissions are used to control what users/bot can do. If you or the bot do not have the required permission to use a command, you will be informed.',
				},
				{
					name: 'What to do if you need help',
					value:
						'If you need help with the bot, you can join the support server by typing `/invite` and clicking the invite button.',
				}
			)
			.setFooter({ text: FooterText, iconURL: FooterImage })
			.setTimestamp();

		await interaction.editReply({ embeds: [Embed] });
	},
};
