const { Events, EmbedBuilder, Client } = require('discord.js');
const {
	cleanConsoleLog,
	cleanConsoleLogData,
} = require('../../utils/ConsoleLogs.js');

const BotStats = require('../../models/BotStats.js');
require('dotenv').config();
const {
	FooterImage,
	FooterText,
	EmbedColour,
	DeveloperMode,
	PremiumUserRoleID,
	DeveloperGuildID,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;

module.exports = {
	name: Events.ClientReady,
	once: true,
	nickname: 'Bot Stats',

	/**
	 * @param {Client} client
	 * @returns
	 */

	async execute(client) {
		// fetch all guilds
		const guilds = await client.guilds.fetch();

		var guildsCount;
		var usersCount;
		var channelsCount;
		var uptimeCount;
		var emojisCount;
		var rolesCount;
		let startTime = Date.now();

		const messageToEdit =
			DeveloperMode === 'true'
				? await client.channels.cache
						.get('1115340622027575306')
						.messages.fetch('1158549863546499143')
				: await client.channels.cache
						.get('1115340622027575306')
						.messages.fetch('1158595086116999238');

		async function getStats() {
			// Getting stats from database
			const BotStatsData = await BotStats.findOne({
				client: client.user.id,
			});

			// Checking if stats exist
			if (!BotStatsData) {
				// Creating stats
				const newBotStats = new BotStats({
					client: client.user.id,
					guilds: 0,
					users: 0,
					channels: 0,
					uptime: 0,
					emojis: 0,
					roles: 0,
				});

				// Saving stats
				newBotStats.save();

				cleanConsoleLogData('Bot Stats', `no stats found`, 'error');
				return;
			}

			// Collecting stats for bot
			guildsCount = client.guilds.cache.size;
			usersCount = client.users.cache.size;
			channelsCount = client.channels.cache.size;
			uptimeCount = 0;
			emojisCount = client.emojis.cache.size;
			rolesCount = client.guilds.cache.reduce(
				(a, g) => a + g.roles.cache.size,
				0
			);

			// Updating stats

			// Updating guilds count
			if (guildsCount > BotStatsData.guilds) {
				BotStatsData.guilds = guildsCount;
				cleanConsoleLogData(
					'Bot Stats',
					`New Guild Statistic: ${guildsCount.toLocaleString()}`,
					'success'
				);
			}

			// Updating users count
			if (usersCount > BotStatsData.users) {
				BotStatsData.users = usersCount;
				cleanConsoleLogData(
					'Bot Stats',
					`New Users Statistic: ${usersCount.toLocaleString()}`,
					'success'
				);
			}

			// Updating channels count
			if (channelsCount > BotStatsData.channels) {
				BotStatsData.channels = channelsCount;
				cleanConsoleLogData(
					'Bot Stats',
					`New Channels Statistic: ${channelsCount.toLocaleString()}`,
					'success'
				);
			}

			// Updating emojis count
			if (emojisCount > BotStatsData.emojis) {
				BotStatsData.emojis = emojisCount;
				cleanConsoleLogData(
					'Bot Stats',
					`New Emojis Statistic: ${emojisCount.toLocaleString()}`
				);
			}

			// Updating roles count
			if (rolesCount > BotStatsData.roles) {
				BotStatsData.roles = rolesCount;
				cleanConsoleLogData(
					'Bot Stats',
					`New Roles Statistic: ${rolesCount.toLocaleString()}`,
					'success'
				);
			}

			// Updating uptime count
			const currentTime = Date.now();
			var uptimeInSeconds = Math.floor((currentTime - startTime) / 1000);
			if (uptimeInSeconds > BotStatsData.uptime) {
				BotStatsData.uptime = uptimeInSeconds;

				cleanConsoleLogData(
					'Bot Stats',
					`New Uptime Statistic: ${uptimeInSeconds.toLocaleString()}`,
					'success'
				);
			}

			// Saving stats
			await BotStatsData.save();

			cleanConsoleLogData(
				'Bot Stats',
				`Guilds: ${guildsCount.toLocaleString()} | Users: ${usersCount.toLocaleString()} | Channels: ${channelsCount.toLocaleString()}`,
				'debug'
			);

			cleanConsoleLogData(
				'Bot Stats',
				`Roles: ${rolesCount.toLocaleString()} | Uptime: ${uptimeInSeconds.toLocaleString()} | Emojis: ${emojisCount.toLocaleString()}`,
				'debug'
			);

			// converting uptimeInSeconds to a readable format
			uptimeInSeconds = BotStatsData.uptime;
			const secondsInADay = 86400;
			const secondsInAnHour = 3600;
			const secondsInAMinute = 60;

			const days = Math.floor(uptimeInSeconds / secondsInADay);
			const hours = Math.floor(
				(uptimeInSeconds % secondsInADay) / secondsInAnHour
			);
			const minutes = Math.floor(
				(uptimeInSeconds % secondsInAnHour) / secondsInAMinute
			);
			const String = `${days} days, ${hours} hours, ${minutes} minutes`;

			const currentTimeString = `<t:${Math.floor(Date.now() / 1000)}:R>`;

			const Embed = new EmbedBuilder()
				.setTitle(`Bot Top Statistics`)
				.setColor(EmbedColour)
				.addFields(
					{
						name: `Guilds`,
						value: `${BotStatsData.guilds.toLocaleString()}`,
						inline: true,
					},
					{
						name: 'Users',
						value: `${BotStatsData.users.toLocaleString()}`,
					},
					{
						name: 'Channels',
						value: `${BotStatsData.channels.toLocaleString()}`,
					},
					{
						name: 'Roles',
						value: `${BotStatsData.roles.toLocaleString()}`,
					},
					{
						name: 'Emojis',
						value: `${BotStatsData.emojis.toLocaleString()}`,
					},
					{
						name: 'Uptime',
						value: `${String}`,
					},
					{
						name: 'Last Updated',
						value: currentTimeString,
					}
				)
				.setFooter({ text: FooterText, iconURL: FooterImage })
				.setTimestamp();

			// Sending embed
			await messageToEdit.edit({ embeds: [Embed] });
		}
		setInterval(getStats, 60000 * 10);

		getStats();

		// Storing stats in database
	},
};
