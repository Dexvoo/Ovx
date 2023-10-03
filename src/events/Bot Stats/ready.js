const { Events, EmbedBuilder } = require('discord.js');
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

	async execute(client) {
		var guildsCount;
		var usersCount;
		var channelsCount;
		var uptimeCount;
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
				});

				// Saving stats
				newBotStats.save();

				cleanConsoleLogData('Bot Stats', `no stats found`);
				return;
			}

			// Collecting stats for bot
			guildsCount = client.guilds.cache.size;
			usersCount = client.users.cache.size;
			channelsCount = client.channels.cache.size;
			uptimeCount = 0;

			// Updating stats

			// Updating guilds count
			if (guildsCount > BotStatsData.guilds) {
				BotStatsData.guilds = guildsCount;
				cleanConsoleLogData('Bot Stats', `New Guild Statistic: ${guildsCount}`);
			}

			// Updating users count
			if (usersCount > BotStatsData.users) {
				BotStatsData.users = usersCount;
				cleanConsoleLogData('Bot Stats', `New Users Statistic: ${usersCount}`);
			}

			// Updating channels count
			if (channelsCount > BotStatsData.channels) {
				BotStatsData.channels = channelsCount;
				cleanConsoleLogData(
					'Bot Stats',
					`New Channels Statistic: ${channelsCount}`
				);
			}

			// Updating uptime count
			const currentTime = Date.now();
			var uptimeInSeconds = Math.floor((currentTime - startTime) / 1000);
			if (uptimeInSeconds > BotStatsData.uptime) {
				BotStatsData.uptime = uptimeInSeconds;

				cleanConsoleLogData(
					'Bot Stats',
					`New Uptime Statistic: ${uptimeInSeconds}`
				);
			}

			// Saving stats
			await BotStatsData.save();
			console.log(
				`Bot Stats: Guilds: ${guildsCount} | Users: ${usersCount} | Channels: ${channelsCount} | Uptime: ${uptimeInSeconds}`
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

			const Embed = new EmbedBuilder()
				.setTitle(`Bot Top Statistics`)
				.setColor(EmbedColour)
				.addFields(
					{
						name: `Guilds`,
						value: `${BotStatsData.guilds}`,
						inline: true,
					},
					{
						name: 'Users',
						value: `${BotStatsData.users}`,
					},
					{
						name: 'Channels',
						value: `${BotStatsData.channels}`,
					},
					{
						name: 'Uptime',
						value: `${String}`,
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
