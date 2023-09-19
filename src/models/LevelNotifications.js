const { Schema, model } = require('mongoose');

const serverLevelNotificationsSchema = new Schema({
	guild: {
		type: String,
		required: true,
	},
	notifications: {
		type: Boolean,
		default: true,
	},
	channel: {
		type: String,
	},
});

module.exports = model(
	'Server-Level-Notifications',
	serverLevelNotificationsSchema
);
