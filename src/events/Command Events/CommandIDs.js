const { Events, Client, ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

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
			.then(async (commands) => {

				let noSubCommandsArray = [];
				let subGroupCommandsArray = [];
				let subCommandsArray = [];
				

				let noSubCommands = [];
				let subGroupCommands = [];
				let subCommands = [];
				
				
				commands.toJSON().forEach((command) => {

					const rawCommand = client.commands.get(command.name);
					const ALLCOMMANDSARRAY = [];



					noSubCommands = command.options.filter((v) => v.type === ApplicationCommandOptionType.Subcommand || v.type === ApplicationCommandOptionType.SubcommandGroup).length === 0;
					subGroupCommands = command.options.filter((v) => v.type === ApplicationCommandOptionType.SubcommandGroup);
					subCommands = command.options.filter((v) => v.type === ApplicationCommandOptionType.Subcommand);


					
					if (noSubCommands) {
						noSubCommandsArray.push(`</${command.name}:${command.id}>`);
						ALLCOMMANDSARRAY.push(`</${command.name}:${command.id}>`);
					} 
					if (subGroupCommands) {
						subGroupCommands.forEach((group) => {

							// loop group.options.length times
							group.options.forEach((sub) => {
								subGroupCommandsArray.push(`</${command.name} ${group.name} ${sub.name}:${command.id}>`);
								ALLCOMMANDSARRAY.push(`</${command.name} ${group.name} ${sub.name}:${command.id}>`);
							});
						});
					}
					if (subCommands) {
						subCommands.forEach((sub) => {
							subCommandsArray.push(`</${command.name} ${sub.name}:${command.id}>`);
							ALLCOMMANDSARRAY.push(`</${command.name} ${sub.name}:${command.id}>`);
						});
					}

					rawCommand.commandTags = ALLCOMMANDSARRAY

					client.commands.set(command.name, rawCommand);
					
					
					
				});

				// console.log(client.commands);

				const Embed = new EmbedBuilder()
						.setTitle('Commands')
						.addFields(
							{ name: 'No Sub Commands', value: noSubCommandsArray.join('\n') || 'None' },
							{ name: 'Sub Command Groups', value: subGroupCommandsArray.join('\n') || 'None' },
							{ name: 'Sub Commands', value: subCommandsArray.join('\n') || 'None' },
						);

					// client.channels.cache.get('1115341959016480848').send({ embeds: [Embed] });
			});
	},
};