const { Schema, model } = require('mongoose');

const LevelRewards = new Schema(
	{
		guildId: {
			type: String,
			required: true,
		},
		guildData: [
			{
				roleId: {
					type: String,
					required: true,
				},
				percentage: {
					type: Number,
					required: true,
				},
			},
		],
	},
	{
		timestamps: true,
	}
);

module.exports = model('Guild-XP-Boosters', LevelRewards);
