const { Events, Client, ActivityType } = require('discord.js');
const { DevGuildID } = process.env;

module.exports = {
	name: Events.ClientReady,
	once: true,
	nickname: 'Client Presence',

	/**
	 * @param {Client} client - Discord Client
	 */

	async execute(client) {
		client.user.setActivity(`Ovx! #${client.shard?.ids?.[0]}`, {
			type: ActivityType.Watching,
		});
	}
};