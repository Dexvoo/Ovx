const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const UserLevelSchema = new Schema({
    userId: {
        type: String,
        required: true,
    },
    guildId: {
        type: String,
        required: true,
    },
    xp: {
        type: Number,
        required: true,
        default: 0,
    },
    level: {
        type: Number,
        required: true,
        default: 0,
    },
	totalMessages: {
		type: Number,
		required: true,
		default: 1,
	},
	totalVoice: {
		type: Number,
		required: true,
		default: 0,
	},
	
});

module.exports = {
    UserLevels: model('Guild-User-Levels', UserLevelSchema),
};