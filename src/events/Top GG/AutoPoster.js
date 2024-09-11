const { Events, Client } = require('discord.js');
const { TopggAPIKey, DeveloperMode } = process.env;

const { AutoPoster } = require('topgg-autoposter');
module.exports = {
	name: Events.ClientReady,
	nickname: 'Top GG Stats',
	once: true,

	/**
	 * @param {Client} client
	 */

	async execute(client) {
		if (DeveloperMode) return;

		const ap = AutoPoster(TopggAPIKey, client);

		ap.on('posted', () => {
			console.log('Posted stats to Top.gg!');
		});
		ap.on('error', (e) => {
			console.log(`Error posting stats to Top.gg: ${e}`);
		});
	},
};
