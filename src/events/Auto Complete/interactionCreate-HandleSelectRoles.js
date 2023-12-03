const {
	EmbedBuilder,
	Events,
	Guild,
	AuditLogEvent,
	CommandInteraction,
	Interaction,
	ChannelType,
	PermissionFlagsBits,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	PermissionsBitField,
} = require('discord.js');
const { FooterText, FooterImage, EmbedColour } = process.env;

module.exports = {
	name: Events.InteractionCreate,
	nickname: 'Suggestions',

	/**
	 * @param {Interaction} interaction
	 */

	async execute(interaction) {
		// deconstructing interaction
		const { commandName, client } = interaction;
		console.log('Getting triggered');

		if (!interaction.isAutocomplete()) return;

		try {
			const command = client.commands.get(commandName);

			if (!command) {
				console.error(`No command matching ${commandName} was found.`);
				return;
			}

			console.log(`Autocomplete: ${commandName}`);

			await command.autocomplete(interaction);
		} catch (error) {
			console.log(error);
		}
	},
};
