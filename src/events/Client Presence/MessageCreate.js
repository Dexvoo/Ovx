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
				`with ${client.guilds.cache.size} guilds`,
				`with ${client.users.cache.size} users`,
				`with ${client.channels.cache.size} channels`,
				`with ${client.guilds.cache.reduce(
					(a, g) => a + g.memberCount,
					0
				)} users`,
				`with ${client.guilds.cache.reduce(
					(a, g) => a + g.channels.cache.size,
					0
				)} channels`,
				`with ${client.guilds.cache.reduce(
					(a, g) => a + g.roles.cache.size,
					0
				)} roles`,
				`with ${client.guilds.cache.reduce(
					(a, g) => a + g.emojis.cache.size,
					0
				)} emojis`,
				`with ${client.guilds.cache.reduce(
					(a, g) => a + g.voiceStates.cache.size,
					0
				)} voice states`,
				`with ${client.guilds.cache.reduce(
					(a, g) => a + g.members.cache.filter((m) => m.user.bot).size,
					0
				)} bots`,
				`with ${client.guilds.cache.reduce(
					(a, g) => a + g.members.cache.filter((m) => !m.user.bot).size,
					0
				)} users`,
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
