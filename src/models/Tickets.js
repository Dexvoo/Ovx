const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const TicketsSchema = new Schema({
    guildId: {
        type: String,
        required: true,
    },
    memberId: {
        type: String,
        required: true,
    },
    ticketId: {
        type: String,
        required: true,
    },
    ticketChannelId: {
        type: String,
        required: true,
    },
    ticketOpen: {
        type: Boolean,
        default: true,
    },
    ticketLocked: {
        type: Boolean,
        default: false,
    },
	
});

module.exports = {
    UserTickets: model('Guild-Tickets-Info', TicketsSchema),
};