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
	emojis: {
		type: Number,
		required: true,
		default: 0,
	},
	roles: {
		type: Number,
		required: true,
		default: 0,
	},
});

module.exports = model('Bot-Stats', BotStats);
