const { Schema, model } = require('mongoose');

const InviteDetection = new Schema({
	guildId: {
		type: String,
		required: true,
	},
});

module.exports = model('Guild-Invite-Detection', InviteDetection);
