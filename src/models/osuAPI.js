const { Schema, model } = require('mongoose');

const OsuAPI = new Schema(
	{
		access_token: {
			type: String,
			default: String,
		},
	},
	{
		timestamps: true,
	}
);

module.exports = model('Osu-API', OsuAPI);
