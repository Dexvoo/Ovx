const { Events, Colors } = require('discord.js');
require('dotenv').config()

const handlers = {
	'command': require("../../handlers/Commands/Commands"),
};

module.exports = {
	name: Events.InteractionCreate,
	once: false,
	nickname: 'Command Handler',

	/**
	 * @param {import('../../types').CommandInputUtils} interaction
	 */

	async execute(interaction) {
		
		if(!interaction.isCommand()) return;
		
		const handler = handlers['command'];
		try {
			await handler(interaction);
		} catch (error) {
			console.error(error);
            interaction.client.utils.Embed(interaction, Colors.Red, 'Command Handler', `Error: \`${error.message}\``);
		};
		
	},
}