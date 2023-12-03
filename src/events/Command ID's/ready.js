const { Events, EmbedBuilder, Client } = require('discord.js');
const {
	cleanConsoleLog,
	cleanConsoleLogData,
} = require('../../utils/ConsoleLogs.js');

const BotStats = require('../../models/BotStats.js');
require('dotenv').config();
const {
	FooterImage,
	FooterText,
	EmbedColour,
	DeveloperMode,
	PremiumUserRoleID,
	DeveloperGuildID,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;

module.exports = {
	name: Events.ClientReady,
	once: true,
	nickname: 'Bot Stats',

	/**
	 * @param {Client} client
	 * @returns
	 */

	async execute(client) {
		client.application.commands
			.set(client.commands.map((v) => v.data))
			.then((commands) => {
				commands.toJSON().forEach((command) => {
					const rawCommand = client.commands.get(command.name);

					rawCommand.id = command.id;

					client.commands.set(command.name, rawCommand);
				});
			});
	},
};
