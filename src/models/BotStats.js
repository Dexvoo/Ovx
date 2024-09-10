const { Schema, model } = require('mongoose');

const BotStats = new Schema({
	client: {
		type: String,
		required: true,
	},
	guilds: {
		type: Number,
		default: 0,
	},
	users: {
		type: Number,
		default: 0,
	},
	channels: {
		type: Number,
		default: 0,
	},
	uptime: {
		type: Number,
		default: 0,
	},
	emojis: {
		type: Number,
		default: 0,
	},
	roles: {
		type: Number,
		default: 0,
	},
});

module.exports = model('Bot-Stats', BotStats);
