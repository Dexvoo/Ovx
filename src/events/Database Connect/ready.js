const { ActivityType, Events } = require('discord.js');
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

	async execute(client) {
		// Variables
		const dbString = `${dbUrl}/${dbName}`;
		const dbOptions = {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		};

		// Database connection
		mongoose.set('strictQuery', false);
		await mongoose
			.connect(dbString, dbOptions)
			.then(() => {
				// Logging to console
				cleanConsoleLogData('Database', 'Connected', 'success');
				cleanConsoleLogData('Bot', 'Online', 'success');
				cleanConsoleLog('Database Connected');
			})
			.catch((error) => {
				// Logging to console
				cleanConsoleLogData('Database is not connected', ' ', 'error');
				cleanConsoleLogData('Bot', 'Online', 'success');
				cleanConsoleLog('Database Connection Failed');
			});
	},
};
