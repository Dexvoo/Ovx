const { Schema, model } = require('mongoose');

const GuildAFKUsers = new Schema({
	guild: {
		type: String,
		required: true,
	},
	users: {
		type: Array,
		required: true,
	},
});

module.exports = model('Guild-AFK-Users', GuildAFKUsers);
