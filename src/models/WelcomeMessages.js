const { Schema, model } = require('mongoose');

const WelcomeMessagesSchema = new Schema({
	guild: {
		type: String,
		required: true,
	},
	channel: {
		type: String,
		required: true,
	},
	message: {
		type: String,
		required: false,
	},
	role: {
		type: String,
		required: false,
	},
});

module.exports = model('User-Welcome-Messages', WelcomeMessagesSchema);
