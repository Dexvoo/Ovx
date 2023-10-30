const { Schema, model } = require('mongoose');

const RobloxVerifiedUsers = new Schema({
	robloxUserId: {
		type: String,
		required: true,
	},
	discordUserId: {
		type: String,
		required: true,
	},
});

module.exports = model('Roblox-Verified-Users', RobloxVerifiedUsers);
