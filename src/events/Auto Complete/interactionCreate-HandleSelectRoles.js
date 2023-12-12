const { Events, Interaction } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	once: false,
	nickname: 'Suggestions',

	/**
	 * @param {Interaction} interaction
	 */

	async execute(interaction) {
		// deconstructing interaction
		const { commandName, client } = interaction;

		if (!interaction.isAutocomplete()) return;

		try {
			const command = client.commands.get(commandName);

			if (!command) {
				console.error(`No command matching ${commandName} was found.`);
				return;
			}

			await command.autocomplete(interaction);
		} catch (error) {
			console.log(error);
		}
	},
};
