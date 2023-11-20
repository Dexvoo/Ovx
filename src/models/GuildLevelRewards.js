const { Schema, model } = require('mongoose');

const LevelRewards = new Schema(
	{
		rewardsId: {
			type: String,
			default: crypto.randomUUID(),
		},
		guildId: {
			type: String,
			required: true,
		},
		rewards: {
			type: [
				{
					level: {
						type: Number,
						required: true,
					},
					role: {
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

module.exports = model('Guild-Level-Rewards', LevelRewards);
