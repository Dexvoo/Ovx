const { Events, Interaction } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	once: false,
	nickname: 'Command AutoComplete',

	/**
	 * @param {Interaction} interaction
	 */

	async execute(interaction) {
		const { commandName, client } = interaction;

		if(!interaction.isAutocomplete()) return;

		try {
			const command = client.commands.get(commandName);
			if (command) {
				await command.autocomplete(interaction);
			} else {
				console.error(`No command matching ${commandName} was found.`);
				return;
			}
		} catch (error) {
			console.error(error);
		}

	},
};
