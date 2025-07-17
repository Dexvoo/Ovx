const { Events, Client, PresenceUpdateStatus } = require('discord.js');
const { DevGuildID } = process.env;

module.exports = {
	name: Events.ClientReady,
	once: true,
	nickname: 'Client Presence',

	/**
	 * @param {Client} client - Discord Client
	 */

	async execute(client) {
		client.user.setPresence({ activities: [{ name: `Ovx! #${client.shard?.ids?.[0]}` }], status: PresenceUpdateStatus.Idle });
	}
};