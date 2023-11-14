const { Schema, model } = require('mongoose');

const TicketInformation = new Schema({
	guildid: {
		type: String,
	},
	memberid: {
		type: String,
	},
	ticketid: {
		type: String,
	},
	channelid: {
		type: String,
	},
	closed: {
		type: Boolean,
	},
	locked: {
		type: Boolean,
	},
});

module.exports = model('Guild-Ticket-Information', TicketInformation);
