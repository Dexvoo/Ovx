const { Schema, model } = require('mongoose');

const UserCurrency = new Schema({
	userid: {
		type: String,
		required: true,
	},
	currency: {
		type: Number,
		default: 1000,
	},
});

module.exports = model('User-Currency', UserCurrency);
