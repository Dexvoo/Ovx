const { Events, CommandInteraction, Colors } = require('discord.js');
const { SendEmbed } = require('../../utils/LoggingData');
require('dotenv').config()

const handlers = {
	'command': require("../../handlers/Commands/Commands"),
};

module.exports = {
	name: Events.InteractionCreate,
	once: false,
	nickname: 'Command Handler',

	/**
	 * @param {CommandInteraction} interaction
	 */

	async execute(interaction) {
		
		if(!interaction.isCommand()) return;
		
		const handler = handlers['command'];
		try {
			await handler(interaction);
		} catch (error) {
			console.error(error);
            SendEmbed(interaction, Colors.Red, 'Command Handler', `Error: \`${error.message}\``);
		};
		
	},
}