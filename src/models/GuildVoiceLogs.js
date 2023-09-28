const { Schema, model } = require('mongoose');

const VoiceLogs = new Schema({
	guild: {
		type: String,
		required: true,
	},
	channel: {
		type: String,
		required: true,
	},
});

module.exports = model('Guild-Logs-Voice', VoiceLogs);
