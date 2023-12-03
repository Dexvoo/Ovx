const {
	SlashCommandBuilder,
	EmbedBuilder,
	CommandInteraction,
	PermissionFlagsBits,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const { data } = require('./AFK.js');
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
		.setName('help')
		.setDescription('Bot explanation')
		.setDMPermission(false)
		.addStringOption((option) =>
			option
				.setName('command')
				.setDescription('The command you would like to get help for.')
				.setAutocomplete(true)
				.setRequired(false)
		),
	/**
	 * @param {CommandInteraction} interaction
	 */

	async autocomplete(interaction) {
		const value = interaction.options.getFocused();
		const commands = interaction.client.commands;

		let choices = [];
		await commands.forEach((command) => {
			if (command.catagory !== 'Developer') {
				choices.push(command.data.name);
			}
		});

		const filteredChoices = choices
			.filter((choice) => choice.toLowerCase().includes(value))
			.slice(0, 25);

		if (!interaction) return;

		await interaction.respond(
			filteredChoices.map((choice) => ({
				name: choice,
				value: choice,
			}))
		);
	},
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

			const gamesCommandList = commands
				.filter((command) => command.catagory === 'Games')
				.map((command) => `</${command.data.name}:${command.id}>`)
				.join('\n');

			const miscellaneousCommandList = commands
				.filter((command) => command.catagory === 'Miscellaneous')
				.map((command) => `</${command.data.name}:${command.id}>`)
				.join('\n');

			const moderationCommandList = commands
				.filter((command) => command.catagory === 'Moderation')
				.map((command) => `</${command.data.name}:${command.id}>`)
				.join('\n');

			const robloxCommandList = commands
				.filter((command) => command.catagory === 'Roblox')
				.map((command) => `</${command.data.name}:${command.id}>`)
				.join('\n');

			const levelCommandList = commands
				.filter((command) => command.catagory === 'Level')
				.map((command) => `</${command.data.name}:${command.id}>`)
				.join('\n');

			const embed = new EmbedBuilder()
				.setTitle('Help')
				.setDescription(
					`Welcome to the help menu, here you can find all the commands for the bot.\n\nTo get help with a specific command, use \`/help <command>\``
				)
				.addFields(
					{
						name: 'Games',
						value: gamesCommandList || 'No commands found',
						inline: false,
					},
					{
						name: 'Miscellaneous',
						value: miscellaneousCommandList || 'No commands found',
						inline: false,
					},
					{
						name: 'Moderation',
						value: moderationCommandList || 'No commands found',
						inline: false,
					},
					{
						name: 'Roblox',
						value: robloxCommandList || 'No commands found',
						inline: false,
					},
					{
						name: 'Level',
						value: levelCommandList || 'No commands found',
						inline: false,
					}
				)
				.setColor(EmbedColour);

			// Default help embed
			await interaction.editReply({ embeds: [embed] });
			return;
		}

		const command = client.commands.get(targetCommand);

		if (!command) {
			sendEmbed(interaction, 'Command not found');
			return;
		}

		if (command.data.options.length > 1) {
			const options = command.data.options;

			var optionsNames = [];
			var optionsDescriptions = [];
			var optionsOptionNames = [];
			// loop through options
			for (const option of options) {
				optionsNames.push(
					option.name.charAt(0).toUpperCase() + option.name.slice(1)
				);
				optionsDescriptions.push(
					option.description.charAt(0).toUpperCase() +
						option.description.slice(1)
				);

				if (option.options) {
					optionsOptionNames.push(
						option.options.map((option) => `{${option.name}}`)
					);
				}

				if (!option.options) {
					optionsOptionNames.push('No options found');
				}

				if (!option.description) {
					optionsDescriptions.push('No description found');
				}

				if (!option.name) {
					optionsNames.push('No name found');
				}
			}

			// loop through optionsNames with index

			var string = '';

			for (let i = 0; i < optionsNames.length; i++) {
				string += `**${optionsNames[i]}**:\n\`${optionsDescriptions[i]}\n${
					optionsOptionNames[i] || 'No Options Found'
				}\`\n\n`;
			}

			const embed = new EmbedBuilder()
				.setTitle(
					`Help: ${
						command.data.name.charAt(0).toUpperCase() +
						command.data.name.slice(1)
					}`
				)
				.setDescription(`${command.data.description} \n\n${string}`)
				.setColor(EmbedColour);

			await interaction.editReply({ embeds: [embed] });
			return;
		}

		const commandName =
			command.data.name.charAt(0).toUpperCase() + command.data.name.slice(1);

		const Embed = new EmbedBuilder()
			.setTitle(`Help: ${commandName}`)
			.setDescription(command.data.description || 'No help usage found')
			.setColor(EmbedColour);

		await interaction.editReply({ embeds: [Embed] });
	},
};
