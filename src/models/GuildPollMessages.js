const { Schema, model } = require('mongoose');

const PollMessages = new Schema(
	{
		pollId: {
			type: String,
			default: crypto.randomUUID(),
		},
		authorId: {
			type: String,
			required: true,
		},
		guildId: {
			type: String,
			required: true,
		},
		messageId: {
			type: String,
			required: true,
			unique: true,
		},
		content: {
			type: String,
			required: true,
		},
		upvotes: {
			type: [String],
			default: [],
		},
		downvotes: {
			type: [String],
			default: [],
		},
	},
	{
		timestamps: true,
	}
);

module.exports = model('Guild-Poll-Messages', PollMessages);
