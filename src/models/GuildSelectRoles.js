const { Schema, model } = require('mongoose');

const LevelRewards = new Schema(
	{
		messageId: {
			type: String,
			required: true,
		},
		channelId: {
			type: String,
			required: true,
		},
		guildId: {
			type: String,
			required: true,
		},
		data: {
			type: [
				{
					roleId: {
						type: String,
						required: true,
					},
					roleName: {
						type: String,
						required: true,
						default: 'New Role',
					},
					roleDescription: {
						type: String,
						required: true,
					},
					roleEmoji: {
						type: String,
						required: true,
					},
				},
			],
			default: [],
		},
	},
	{
		timestamps: true,
	}
);

module.exports = model('Guild-Select-Roles', LevelRewards);
