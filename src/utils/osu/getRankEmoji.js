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
	if (!targetMode) targetMode = 'osu';

	console.log('Getting User');

	const ApiKey = await getApiKey();
	const url = `https://osu.ppy.sh/api/v2/users/${username}/${targetMode}`;

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
			console.log('No user found');
			return false;
		});

	return osuData;
};

/**
 * @param { } username - Osu! Username

 */

const getRankEmoji = async (rank) => {
	if (!rank) throw new Error('No rank provided');

	switch (rank) {
		case 'XH':
			return '<:OVX_Rank_XH:1181939267795157093>';
		case 'X':
			return '<:OVX_Rank_X:1181939272790573097>';
		case 'SH':
			return '<:OVX_Rank_SH:1181939265505071215>';
		case 'S':
			return '<:OVX_Rank_S:1181939490923741224>';
		case 'A':
			return '<:OVX_Rank_A:1181939495281631273>';
		case 'B':
			return '<:OVX_Rank_B:1181939488809811998>';
		case 'C':
			return '<:OVX_Rank_C:1181939493285138532>';
		case 'D':
			return '<:OVX_Rank_D:1181939270278193202>';
		case 'F':
			return '<:OVX_Rank_F:1181939263638622328>';
		default:
			return false;
	}
};

module.exports = {
	getRankEmoji,
};
