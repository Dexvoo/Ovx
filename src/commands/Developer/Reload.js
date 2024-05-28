const {
	SlashCommandBuilder,
	EmbedBuilder,
	CommandInteraction,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep, cleanConsoleLog, cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	EmbedColour,
	FooterImage,
	FooterText,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;
require('dotenv').config();
const path = require('node:path');
const fsPromises = require('fs').promises;

module.exports = {
	cooldown: 0,
	catagory: 'Developer',
	data: new SlashCommandBuilder()
		.setName('reload')
		.setDescription('developer reload command.')
		.setDMPermission(false)
		.addStringOption((option) =>
			option
				.setName('command')
				.setDescription('The command to reload.')
				.setRequired(true)
		)
				,

	/**
	 * @param {CommandInteraction} interaction
	 */
	async execute(interaction) {
		try {
			const { guild, member, options, client, channel } = interaction;
	
			if (!guild) return;
			if (member.user.id !== '387341502134878218') {
				await sendEmbed(
					interaction,
					'You do not have permission to use this command.'
				);
				return; // Add return here to prevent further execution
			}
	
			const commandName = options.getString("command").toLowerCase();
			// const command =
			// 	client.commands.get(commandName) ||
			// 	client.commands.find(
			// 		(cmd) => cmd.aliases && cmd.aliases.includes(commandName)
			// 	);
	
			// if (!command) {
			// 	const embed = new EmbedBuilder()
			// 		.setTitle('Error')
			// 		.setDescription('Command not found.')
			// 		.setColor(EmbedColour)
			// 		.setTimestamp()
			// 		.setFooter({ text: FooterText, iconURL: FooterImage });
					
			// 	await interaction.reply({ embeds: [embed], ephemeral: true });
			// 	return;
			// }
	
			const commandsDirectory = path.join(__dirname, '..', '..', 'commands');
			const match = await commandsCrawl(commandsDirectory, commandName);
	
			if (!match) {
				const embed = new EmbedBuilder()
					.setTitle('Error')
					.setDescription('That command does not exist.')
					.setColor(EmbedColour)
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
					
				await interaction.reply({ embeds: [embed], ephemeral: true });
				return;
			}
	
			delete require.cache[require.resolve(match)];
	
			try {
				const newCommand = require(match);
				client.commands.set(newCommand.data.name, newCommand);
				const embed = new EmbedBuilder()
					.setTitle('Success')
					.setDescription(`Successfully reloaded \`${newCommand.data.name}\``)
					.setColor(EmbedColour)
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
	
				await interaction.reply({ embeds: [embed], ephemeral: true });
			} catch (error) {
				const embed = new EmbedBuilder()
					.setTitle('Error')
					.setDescription(`There was an error while reloading \`${commandName}\``)
					.setColor(EmbedColour)
					.setTimestamp()
					.setFooter({ text: FooterText, iconURL: FooterImage });
	
				await interaction.reply({ embeds: [embed], ephemeral: true });
			}
		} catch (error) {
			console.log(error);
		}
	}	
};



async function commandsCrawl(directory, commandName) {
	const dirs = await fsPromises.readdir(directory, {
		withFileTypes: true,
	});

	for (let i = 0; i < dirs.length; i++) {
		let currentDir = dirs[i];
		let newPath = path.join(directory, currentDir.name);

		if (currentDir.isDirectory()) {
			// Recursively search in subdirectories
			const result = await commandsCrawl(newPath, commandName);
			if (result) {
				return result;
			}
		} else {
			if (currentDir.name.endsWith('.js')) {
				const targetCommand = require(newPath);

				if ('data' in targetCommand && 'execute' in targetCommand) {
					if (targetCommand.data.name === commandName) {
						cleanConsoleLogData(
							targetCommand.data.name,
							'We have a match',
							'success'
						);
						return newPath;
					}
				} else {
					cleanConsoleLogData(currentDir.name, ' ', 'error');
				}
			}
		}
	}

	return null; // If no match is found, return null
}