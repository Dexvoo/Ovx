const { Schema, model } = require('mongoose');

const UserDaily = new Schema({
	userId: {
		type: String,
		required: true,
	},
	streak: {
		type: Number,
		default: 0,
	},
	lastClaimed: {
		type: Date,
		default: Date.now,
	},
});

module.exports = model('User-Daily', UserDaily);
