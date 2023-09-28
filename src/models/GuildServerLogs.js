const { Schema, model } = require('mongoose');

const ServerLogs = new Schema({
	guild: {
		type: String,
		required: true,
	},
	channel: {
		type: String,
		required: true,
	},
});

module.exports = model('Guild-Logs-Server', ServerLogs);
