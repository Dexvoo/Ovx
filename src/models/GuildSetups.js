const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const TicketSetupSchema = new Schema({
	guildId: {
		type: String,
		required: true,
		unique: true,
	},
	enabled: {
		type: Boolean,
		default: false,
	},
	setupChannelId: {
		type: String,
		required: true,
	},
	ticketCategoryId: {
		type: String,
		required: true,
	},
	archiveChannelId: {
		type: String,
		required: true,
	},
	supportRoleId: {
		type: String,
		required: true,
	},
	adminRoleId: {
		type: String,
		required: true,
	},
}, {
	timestamps: true
});

module.exports = {
    GuildTickets: model('Guild-Tickets-Setup', TicketSetupSchema),
};