const { Schema, model } = require('mongoose');

const BotStats = new Schema({
	client: {
		type: String,
		required: true,
	},
	guilds: {
		type: Number,
		required: true,
	},
	users: {
		type: Number,
		required: true,
	},
	channels: {
		type: Number,
		required: true,
	},
	uptime: {
		type: Number,
		required: true,
	},
});

module.exports = model('Bot-Stats', BotStats);
