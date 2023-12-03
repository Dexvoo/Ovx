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
const { EmbedColour, LevelUpChannelID } = process.env;
const axios = require('axios');
const { getApiKey } = require('./getApiKey');

/**
 * @param { } username - Osu! Username

 */

const getUser = async (username, targetMode) => {
	if (!username) throw new Error('No username provided.');
	if (!targetMode) throw new Error('No mode provided.');

	const ApiKey = await getApiKey();
	const url = `https://osu.ppy.sh/api/v2/users/${username}/${targetMode}?key=atque`;

	const osuData = await axios
		.get(url, {
			headers: {
				Authorization: `Bearer ${ApiKey}`,
			},
		})
		.then((response) => {
			const { data } = response;
			return data;
		})
		.catch((error) => {
			console.log(error);
			return false;
		});

	return osuData;
};

/**
 * @param {GuildMember} member - GuildMember
 * @param {number} newLevel - Number
 */

module.exports = {
	getUser,
};
