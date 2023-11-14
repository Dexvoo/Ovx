const { Schema, model } = require('mongoose');

const ServerPolls = new Schema({
	guild: {
		type: String,
		required: true,
	},
	channel: {
		type: String,
		required: true,
	},
});

module.exports = model('Guild-Polls', ServerPolls);
