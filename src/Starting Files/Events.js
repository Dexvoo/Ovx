const { Events, Client } = require('discord.js');
const { consoleLogData } = require('../../utils/LoggingData.js');
require('dotenv').config();

module.exports = {
	name: Events.ClientReady,
	once: false,
	nickname: 'Database Connect',

	/**
	 * @param {Client} client - Discord Client
	 */

	async execute(client) {
		
	}
};