const { Schema, model } = require('mongoose');

const TicketSetup = new Schema({
	guild: {
		type: String,
		required: true,
	},
	ticketChannel: {
		type: String,
		required: true,
	},
	archiveChannel: {
		type: String,
		required: true,
	},
	openCategory: {
		type: String,
		required: true,
	},
	closedCategory: {
		type: String,
		required: true,
	},
	modRole: {
		type: String,
		required: true,
	},
	adminRole: {
		type: String,
		required: true,
	},
});

module.exports = model('Guild-Ticket-Setup', TicketSetup);
