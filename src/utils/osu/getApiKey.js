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
const { OsuClientID, OsuClientSecret } = process.env;
const axios = require('axios');
const Osu = require('../../models/osuAPI.js');

/**
 * @param { } username - Osu! Username
 */

const getApiKey = async () => {
	console.log('Getting API Key');
	const apiUrl = 'https://osu.ppy.sh/oauth/token';
	// Data to be sent in the POST request body
	const bodyParameters = {
		client_id: OsuClientID,
		client_secret: OsuClientSecret,
		grant_type: 'client_credentials',
		scope: 'public',
	};

	// Headers to be included in the request
	const headers = {
		'Content-Type': 'application/json', // Adjust the content type based on your API requirements
		Authorization: `application/x-www-form-urlencoded`, // Include authorization header if needed
		// Add more headers as needed
	};

	// check database for access token

	const osuData = await Osu.findOne({});
	if (!osuData) return false;

	const { access_token, updatedAt } = osuData;

	// if the updatedAt is more than 24 hours ago, get a new token

	const timeDifference = Date.now() - updatedAt;
	const hoursDifference = timeDifference / 1000 / 60 / 60;

	if (hoursDifference > 24) {
		axios
			.post(apiUrl, bodyParameters, { headers })
			.then((response) => {
				// Handle the response data

				const { token_type, expires_in, access_token } = response.data;

				// save in database
				Osu.findOneAndUpdate(
					{},
					{
						access_token: access_token,
					},
					{ upsert: true }
				).catch((error) => console.log(error));

				return access_token;
			})
			.catch((error) => console.log(error));
	} else {
		// use the current token
		return access_token;
	}
};

module.exports = {
	getApiKey,
};
