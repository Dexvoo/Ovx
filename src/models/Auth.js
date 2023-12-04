const { Schema, model } = require('mongoose');

const Auth = new Schema(
	{
		discordAccessToken: {
			type: String,
			default: String,
		},
		osuAccessToken: {
			type: String,
			default: String,
		},
		discordId: {
			type: String,
			default: String,
		},
		osuId: {
			type: String,
			default: String,
		},
	},
	{
		timestamps: true,
	}
);

module.exports = model('Auth-Keys', Auth);
