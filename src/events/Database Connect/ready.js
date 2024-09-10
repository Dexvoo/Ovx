const { ActivityType, Events, Client } = require('discord.js');
const mongoose = require('mongoose');
const { dbUrl, dbName } = process.env;
const {
	cleanConsoleLog,
	cleanConsoleLogData,
} = require('../../utils/ConsoleLogs.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	nickname: 'Database Connect',


	/**
	* @param {Client} client
	* @returns
	*/

	async execute(client) {
		// Variables
		const dbString = `${dbUrl}/${dbName}`;

		mongoose.set('strictQuery', false);
		await mongoose.connect(dbString)
		.then(() => {
			cleanConsoleLogData('Database', 'Connected', 'success');
			cleanConsoleLogData('Bot', 'Online', 'success');
			cleanConsoleLog('Database Connected');
			client.user.setActivity(`Ovx!`, {
				type: ActivityType.Watching,
			});
		})
		.catch((error) => {
			cleanConsoleLogData('Database is not connected', ' ', 'error');
			cleanConsoleLogData('Bot', 'Online', 'success');
			cleanConsoleLog('Database Connection Failed');
		});
	},
};
