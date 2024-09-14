const { EmbedBuilder, Events, Client } = require('discord.js');
const { DeveloperMode, TopggAuthorizationKey } = process.env;
const Topgg = require('@top-gg/sdk');
const webhook = new Topgg.Webhook(TopggAuthorizationKey);

const express = require('express');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs');
const app = express();


module.exports = {
	name: Events.ClientReady,
	nickname: 'Top GG Stats',
	once: true,

	/**
	 * @param {Client} client
	 */

	async execute(client) {
		if (DeveloperMode === 'true') return;

		app.post(
			'/webhook-endpoint',
			webhook.listener(async (vote) => {
				console.log(vote);

				const { user, type, query, isWeekend, bot } = vote;

				const embed = new EmbedBuilder();

				switch (type) {
					case 'upvote':
						embed
							.setDescription(`<@${user}> | Voted for <@${bot}>!`)
							.setColor('Green');
						await client.channels.cache
							.get('1172988214756249661')
							.send({ embeds: [embed] });

						break;
					case 'test':
						embed.setDescription(`This is a test`).setColor('Orange');
						await client.channels.cache
							.get('1172988214756249661')
							.send({ content: `<@${user}>`, embeds: [embed] });

						break;
					case 'unvote':
						embed
							.setDescription(`<@${user}> | You can now vote again`)
							.setColor('Green');
						await client.channels.cache
							.get('1172988214756249661')
							.send({ content: `<@${user}>`, embeds: [embed] });

						break;
					default:
						console.log('Unknown');
						break;
				}
			})
		);
		app.listen(25500, () =>
			cleanConsoleLogData('TopGG Votes', 'Listening on port 25500', 'success')
		);
	},
};

// {
// 	user: '387341502134878218',
// 	type: 'upvote',
// 	query: '',
// 	isWeekend: true,
// 	bot: '1149737617013870622'
//   }
