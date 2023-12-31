const { Schema, model } = require('mongoose');

const LevelsSchema = new Schema({
	userId: {
		type: String,
		required: true,
	},
	guildId: {
		type: String,
		required: true,
	},
	xp: {
		type: Number,
		default: 0,
	},
	level: {
		type: Number,
		default: 0,
	},
	messages: {
		type: Number,
		default: 0,
	},
	voice: {
		type: Number,
		default: 0,
	},
});

module.exports = model('User-Levels', LevelsSchema);
