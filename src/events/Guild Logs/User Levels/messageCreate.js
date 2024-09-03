const { EmbedBuilder, Events, Message } = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../../utils/Checks.js');
const LevelsSchema = require('../../../models/GuildLevels.js');
const LevelNotificationsSchema = require('../../../models/LevelNotifications.js');
require('dotenv').config();
const {
	EmbedColour,
	FooterImage,
	FooterText,
	DeveloperMode,
	LevelUpChannelID,
} = process.env;
const { getRandomXP, calculateLevel } = require('../../../utils/XP.js');
const { addUserXP, xpBoosterPercentage } = require('../../../utils/AddXP.js');
const cooldowns = new Set();

module.exports = {
	name: Events.MessageCreate,
	nickname: 'User Levels',
	once: false,

	/**
	 *  @param {Message} message
	 */
	async execute(message) {
		// Deconstructing message
		const { guild, client, member, channel, author } = message;

		if (author.bot || !guild || cooldowns.has(author.id)) return;

		

		const xpBoosterPercentageValue = await xpBoosterPercentage(member); // Get XP booster percentage
        const xpBooster = xpBoosterPercentageValue / 100 + 1; // Convert to multiplier
        var randomXP = Math.floor(getRandomXP(15, 45) * xpBooster);
		// if (author.id == '387341502134878218') randomXP = getRandomXP(100, 300);
		const query = { guildId: guild.id, userId: author.id };

		try {
			const level = await LevelsSchema.findOne(query);

			if (!level) {
				const newLevel = new LevelsSchema({
					userId: author.id,
					guildId: guild.id,
					xp: randomXP,
					messages: 1,
				});
				await newLevel.save().catch((error) => console.log(error));
				cooldowns.add(author.id);
				setTimeout(() => {
					cooldowns.delete(author.id);
				}, 30000);
				return;
			} else {
				level.xp += randomXP;
				if (level.xp >= calculateLevel(level.level)) {
					level.level += 1;

					if (level.level >= 2) {
						level.xp = level.xp - calculateLevel(level.level) + 100;
					} else {
						level.xp = level.xp;
					}

					await addUserXP(member, randomXP, channel);
				}

				level.messages += 1;

				await level.save().catch((err) => {
					console.log(err);
				});
				if (member.id == '387341502134878218') {
					console.log(`-------------------------------------------------------------`);
					console.log(`xpBoosterPercentageValue: ${xpBoosterPercentageValue}`);
					console.log(`xpBooster: ${xpBooster}`);
					console.log(`randomXP: ${randomXP}`);
				} else {

					cooldowns.add(author.id);
				}
				setTimeout(() => {
					cooldowns.delete(author.id);
				}, 30000);
			}
		} catch (error) {
			console.log(error);
		}
	},
};
