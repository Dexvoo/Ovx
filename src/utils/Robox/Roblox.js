const { EmbedBuilder, Client, GuildMember } = require('discord.js');
const { DevGuildID, DisabledFeaturesChannelID } = process.env;


/**
 * @param {Client} client - The client object
 * @param {string} robloxUserId - The reason for disabling the feature
 * @returns
 */
async function GetRobloxBio(client, robloxUserId) {

    if(!client) throw new Error('No client provided.');
    if(!robloxUserId) throw new Error('No robloxUserId provided.');

    // make a get request
		const Host = 'https://apis.roblox.com/cloud/v2/';
		const url = `${Host}users/${robloxUserId}`;

		const options = {
			method: 'GET',
			headers: {
				'x-api-key': 'SkhYteHsM0yiFhGrwD+aB/Kja6Iu/tY4G3eil949wowDdyUKZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaVlYTmxRWEJwUzJWNUlqb2lVMnRvV1hSbFNITk5NSGxwUm1oSGNuZEVLMkZDTDB0cVlUWkpkUzkwV1RSSE0yVnBiRGswT1hkdmQwUmtlVlZMSWl3aWIzZHVaWEpKWkNJNklqVXlOelU0T0RBNU16RWlMQ0poZFdRaU9pSlNiMkpzYjNoSmJuUmxjbTVoYkNJc0ltbHpjeUk2SWtOc2IzVmtRWFYwYUdWdWRHbGpZWFJwYjI1VFpYSjJhV05sSWl3aVpYaHdJam94TnpNek9EYzROemszTENKcFlYUWlPakUzTXpNNE56VXhPVGNzSW01aVppSTZNVGN6TXpnM05URTVOMzAuYzdhYmJ3NWtITE1zS2VQZml4eHFVd1dwM0tQQzBMVk5ldjVCemxMX2UtYUFlODV3cXhBX3MzYTdHeTF1T2tPVElINHJEV2NaVzVZc29vRmt4Wno4OFEweEEybG5yNVJEN0Y1RkNyNS01YUZ1bFRMdG9IbmVHMHRid0tiMUdicTZjQ19icEMtODFOcDdrakJWYWcxVlVJVWJhbDZNWU5zZTZTUDQ0RnRuY2xCekJJVk41R2FEVlZubWJuSndibW9hRHZCWlQwUm1KRGFyUHN4dGNYSk1meGFKT3lmZXFBclRzbnkxSnRpbUdaODZrQkRaMDI2MWIybGNyNzlJZk1Zc0xmUHJ2aWM1MXVKaHVMZmd2U2d4LUY1YUdFa0liRWoyVWNUTGJDd0NVdjVYcUE3OHV4c1pGZGRranlmN05qMDZHV2xLbWlzbEo1SDcyN1J1OTJaOEN3',
			},
		};


		// fetch data
		const response = await fetch(url, options);
		const data = await response.json();

		// log data
		console.log(data);

        // check if the data is valid
        if (!data) return false;

        return data.about;

}


module.exports = { GetRobloxBio };