const { Schema, model } = require('mongoose');

const ChannelLogs = new Schema({
	guild: {
		type: String,
		required: true,
	},
	channel: {
		type: String,
		required: true,
	},
});

module.exports = model('Guild-Logs-Channel', ChannelLogs);
