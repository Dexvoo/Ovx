const { Events, Client } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	nickname: 'Command ID\'s',

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
