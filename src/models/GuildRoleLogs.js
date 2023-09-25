const { Schema, model } = require('mongoose');

const RoleLogs = new Schema({
	guild: {
		type: String,
		required: true,
	},
	channel: {
		type: String,
		required: true,
	},
});

module.exports = model('Guild-Logs-Roles', RoleLogs);
