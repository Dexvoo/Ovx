const { ActivityType, Events } = require('discord.js');
const CLIENT_ACTIVITY = ActivityType.Playing;

module.exports = {
	name: Events.ClientReady,
	once: true,
	nickname: 'Client Presence',

	/**
	 * @param {Client} client
	 */

	async execute(client) {
		// Start function
		const repeatingFunction = async () => {
			// Variables
			const textArray = [
				`with ${client.guilds.cache.size.toLocaleString()} guilds`,
				`with ${client.channels.cache.size.toLocaleString()} channels`,
				`with ${client.guilds.cache
					.reduce((a, g) => a + g.memberCount, 0)
					.toLocaleString()} users`,
				`with ${client.guilds.cache
					.reduce((a, g) => a + g.channels.cache.size, 0)
					.toLocaleString()} channels`,
				`with ${client.guilds.cache
					.reduce((a, g) => a + g.roles.cache.size, 0)
					.toLocaleString()} roles`,
				`with ${client.guilds.cache
					.reduce((a, g) => a + g.emojis.cache.size, 0)
					.toLocaleString()} emojis`,
				`with ${client.guilds.cache
					.reduce((a, g) => a + g.voiceStates.cache.size, 0)
					.toLocaleString()} voice states`,
				`with ${client.guilds.cache
					.reduce(
						(a, g) => a + g.members.cache.filter((m) => m.user.bot).size,
						0
					)
					.toLocaleString()} bots`,
			];
			const randomNumberOfArray = Math.floor(Math.random() * textArray.length);
			const clientActivityText = textArray[randomNumberOfArray];

			// Set client presence
			client.user.setPresence({
				activities: [
					{
						name: `${clientActivityText}`,
						type: CLIENT_ACTIVITY,
					},
				],
				status: 'dnd',
			});

			// Repeat function every 10 seconds
			setTimeout(repeatingFunction, 10000);
		};
		// Start function
		repeatingFunction();
	},
};
