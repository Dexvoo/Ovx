const {
	SlashCommandBuilder,
	EmbedBuilder,
	CommandInteraction,
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
		.setDMPermission(false)
		.addStringOption((option) =>
			option
				.setName('command')
				.setDescription('The command you would like to get help for.')
				.setRequired(false)
		),
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

		// get commands
		const targetCommand = options.getString('command');

		if (!targetCommand) {
			const commands = client.commands;
			const robloxCommandList = commands
				.filter((command) => command.catagory === 'Roblox')
				.map((command) => `/${command.data.name} | ${command.helpUsage}`)
				.join('\n');

			// how would i make the commands be catagorized?
			// like this:
			// /roblox
			// /roblox avatar
			// /roblox verify
			// /roblox verify <user>

			// Default help embed
			sendEmbed(interaction, `Roblox Command List:\n${robloxCommandList}`);
			return;
		}

		const command = client.commands.get(targetCommand);

		if (!command) {
			sendEmbed(interaction, 'Command not found');
			return;
		}

		const commandName =
			command.data.name.charAt(0).toUpperCase() + command.data.name.slice(1);

		const Embed = new EmbedBuilder()
			.setTitle(`Help: ${commandName}`)
			.setDescription(command.helpUsage || 'No help usage found')
			.setColor(EmbedColour);

		await interaction.editReply({ embeds: [Embed] });
	},
};
