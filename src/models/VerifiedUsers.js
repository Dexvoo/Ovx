const { Schema, model } = require('mongoose');

const VerificationInformation = new Schema({
	robloxUserId: {
		type: String,
	},
	osuUserId: {
		type: String,
	},
	discordUserId: {
		type: String,
		required: true,
	},
});

module.exports = model('Verified-Users', VerificationInformation);
