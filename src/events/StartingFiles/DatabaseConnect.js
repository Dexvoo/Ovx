const { Events, Client } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();
const { MongoDB } = process.env;

module.exports = {
	name: Events.ClientReady,
	once: true,
	nickname: 'Database Connect',

	/**
	 * @param {Client} client - Discord Client
	 */

	async execute(client) {
		mongoose.set('strictQuery', false);
		await mongoose.connect(MongoDB)
			.then(() => client.utils.LogData(`Client: ${client.user.tag} | Shard: #${client.shard.ids}`, 'Database Connected', 'success'))
			.catch((err) => client.utils.LogData(`Client: ${client.user.tag} | Shard: #${client.shard.ids}`, err, 'error'));
	}
}