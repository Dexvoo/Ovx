const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const UserCurrencySchema = new Schema({
    userId: {
        type: String,
        required: true,
    },
    cash: {
        type: Number,
        default: 500,
    },
    bank: {
        type: Number,
        default: 500,
    },
    dailyStreak: {
        type: Number,
        default: 0,
    },
    dailyLastClaimed: {
        type: Date,
        default: new Date(),
    },
    inventory: {
        type: Array,
        default: [],
    },
	
});

const UserVerificationSchema = new Schema({
    discordUserId: {
        type: String,
        required: true,
    },
    robloxUserIds: {
        type: Array,
        default: [],
    },
    osuUserId: {
        type: String,
        default: null,
    },
});


const UserTicketSchema = new Schema({
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
	transcriptURL: {
		type: String,
		default: null,
	},
	closedAt: {
		type: Date,
		default: null,
	},
	closedById: {
		type: String,
		default: null,
	},
}, {
	timestamps: true
});

module.exports = {
    UserCurrency: model('User-Currency', UserCurrencySchema),
    UserVerification: model('User-Verification', UserVerificationSchema),
    UserTickets: model('User-Tickets', UserTicketSchema),
};