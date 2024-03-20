const { ActivityType, Events, EmbedBuilder, Message } = require('discord.js');
const GuildAFKUsers = require('../../models/GuildAFKUsers.js');
const { EmbedColour, DeveloperMode } = process.env;
const { sendEmbed } = require('../../utils/Embeds.js');
const { permissionCheck } = require('../../utils/Checks.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');

module.exports = {
	name: Events.MessageCreate,
	once: false,
	nickname: 'AFK Users',

	/**
	 * @param {Message} message
	 */

	async execute(message) {
		// if (DeveloperMode === 'true') return;
		const { client, guild, member, channel, content, author } = message;
		// Checking if the command is being used in a guild and if the author is a bot
		if (!guild || author.bot) return;

		if (guild.id !== '769000467690422324') return;

		// Bot permissions
		const botPermissionsArry = ['ViewChannel', 'SendMessages', 'EmbedLinks'];
		const botPermissions = await permissionCheck(
			channel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) return;



		// if message content contains "kitten" then send a message
		if (content.includes('kitten')) {
			return channel.send('purr 🐾');
		}
	},
};
