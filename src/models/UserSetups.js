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

module.exports = {
    UserCurrency: model('User-Currency', UserCurrencySchema),
    UserVerification: model('User-Verification', UserVerificationSchema),
};