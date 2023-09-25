const { Schema, model } = require('mongoose');

const UserCurrency = new Schema({
	userid: {
		type: String,
		required: true,
	},
	currency: {
		type: Number,
		required: true,
	},
});

module.exports = model('User-Currency', UserCurrency);
