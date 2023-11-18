const { Schema, model } = require('mongoose');

const PollSetup = new Schema({
	guildId: {
		type: String,
		required: true,
	},
	pollChannelIds: {
		type: [String],
		default: [],
	},
});

module.exports = model('Guild-Poll-Channels', PollSetup);
