require('dotenv').config();
const { FooterText, FooterImage, EmbedColour, ErrorChannelID } = process.env;
const {
	SlashCommandBuilder,
	EmbedBuilder,
	CommandInteraction,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { sleep } = require('../../utils/ConsoleLogs.js');

const Daily = require('../../models/UserDaily.js');
const UserCurrency = require('../../models/UserCurrency.js');

module.exports = {
	cooldown: 5,
	catagory: 'Games',
	data: new SlashCommandBuilder()
		.setName('daily')
		.setDescription('Claim a daily reward.')
		.setDMPermission(false),

	async execute(interaction) {
		try {
			const { options, user, client } = interaction;

			// Placeholder Embed
			await sendEmbed(interaction, `claiming your daily reward`);
			await sleep(2000);

			// Guild Check
			if (!guildCheck(interaction)) return;

			const botPermissionsArry = ['ViewChannel', 'SendMessages'];
			const botPermissions = await permissionCheck(
				interaction,
				botPermissionsArry,
				client
			);

			if (!botPermissions[0]) {
				return await sendEmbed(
					interaction,
					`Bot Missing Permissions: \`${botPermissions[1]}\``
				);
			}

			// Variables
			const userDaily = await Daily.findOne({ userId: user.id });
			var userCurrency = await UserCurrency.findOne({ userid: user.id });
			var dailyRewardBase = 100;

			if (!userCurrency) {
				userCurrency = new UserCurrency({
					userid: user.id,
				});
				userCurrency.save();
			}

			// check if user has already claimed their daily reward within the current day
			if (userDaily) {
				const lastClaimed = userDaily.lastClaimed;
				const streak = userDaily.streak;
				const lastClaimedDate = new Date(lastClaimed);
				const currentDate = new Date();

				// check if user has already claimed their daily reward within the current day

				if (lastClaimedDate.getDate() === currentDate.getDate()) {
					return sendEmbed(
						interaction,
						`You have already claimed your daily reward today!`
					);
				}

				// check if user has claimed their daily reward the day before
				if (lastClaimedDate.getDate() !== currentDate.getDate() - 1) {
					userDaily.lastClaimed = currentDate;
					userDaily.streak = 1;
					userDaily.save();

					userCurrency.currency += dailyRewardBase;
					userCurrency.save();

					return sendEmbed(
						interaction,
						`You have claimed your daily reward of ${dailyRewardBase} coins!`
					);
				}

				for (let i = 0; i < streak; i++) {
					dailyRewardBase += dailyRewardBase * 0.05;
				}

				userDaily.lastClaimed = currentDate;
				userDaily.streak += 1;
				userDaily.save();

				return sendEmbed(
					interaction,
					`You have claimed your daily reward of ${dailyRewardBase} coins!\n Your current streak is \`${userDaily.streak}\` days!`
				);
			}

			// new user that hasnt claimed

			const currentDate = new Date();
			const newUserDaily = new Daily({
				userId: user.id,
				lastClaimed: currentDate,
			});
			newUserDaily.save();

			userCurrency.currency += dailyRewardBase;
			userCurrency.save();

			return sendEmbed(
				interaction,
				`You have claimed your daily reward of ${dailyRewardBase} coins!`
			);
		} catch (error) {
			console.error(error);

			return sendEmbed(
				interaction,
				`There was an error running this command\n\n${error}`
			);
		}
	},
};
