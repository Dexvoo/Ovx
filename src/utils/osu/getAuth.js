const {
	EmbedBuilder,
	CommandInteraction,
	PermissionFlagsBits,
	PermissionsBitField,
	GuildMember,
	VoiceBasedChannel,
	GuildChannel,
} = require('discord.js');
require('dotenv').config();
const { OsuClientID, OsuClientSecret, Redirect_Uri } = process.env;
const axios = require('axios');

/**
 * @param { } username - Osu! Username
 */

const getAuth = async () => {
	const apiUrl = `https://osu.ppy.sh/oauth/authorize?client_id=${OsuClientID}&redirect_uri=${Redirect_Uri}&response_type=code&scope=public+identify&state=randomval`;
	// Data to be sent in the POST request body

	// GET request
	const response = await axios.get(apiUrl, bodyParameters);
	// console.log(response);
};

module.exports = {
	getAuth,
};
