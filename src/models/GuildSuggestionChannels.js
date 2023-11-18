const { Schema, model } = require('mongoose');

const SuggestionSetup = new Schema({
	guildId: {
		type: String,
		required: true,
	},
	suggestionChannelIds: {
		type: [String],
		default: [],
	},
});

module.exports = model('Guild-Suggestions-Channels', SuggestionSetup);
