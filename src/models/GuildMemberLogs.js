const { Schema, model } = require('mongoose');

const MemberLogs = new Schema({
	guild: {
		type: String,
		required: true,
	},
	channel: {
		type: String,
		required: true,
	},
});

module.exports = model('Guild-Logs-Member', MemberLogs);
