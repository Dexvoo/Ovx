const { EmbedBuilder, Events, Message } = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../../utils/Checks.js');
const LevelsSchema = require('../../../models/Levels.js');
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
const cooldowns = new Set();

module.exports = {
	name: Events.MessageCreate,
	nickname: 'User Levels',

	/**
	 *  @param {Message} message
	 */
	async execute(message) {
		// Deconstructing message
		const { guild, client, member, channel, author } = message;

		if (author.bot || !guild || cooldowns.has(author.id)) return;

		if (DeveloperMode == 'true')
			console.log(
				`[EVENT] ${this.nickname} | [MEMBER] @${member.user.username} | [Guild] ${guild.name}`
			);

		// Variables
		var randomXP = getRandomXP(5, 15);
		// if (author.id == '387341502134878218') randomXP = getRandomXP(100, 300);
		const query = { guildId: guild.id };

		try {
			const level = await LevelsSchema.findOne(query);

			if (!level) {
				console.log('No data in database');
				const newLevel = new LevelsSchema({
					userId: author.id,
					guildId: guild.id,
					xp: randomXP,
				});
				await newLevel.save().catch((error) => console.log(error));
				if (author.id == '387341502134878218') return;
				cooldowns.add(author.id);
				setTimeout(() => {
					cooldowns.delete(author.id);
				}, 30000);
			} else {
				level.xp += randomXP;
				if (level.xp >= calculateLevel(level.level)) {
					level.level += 1;

					if (level.level >= 2) {
						level.xp = level.xp - calculateLevel(level.level) + 100;
					} else {
						level.xp = level.xp;
					}

					const LevelUpEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setColor(EmbedColour)
						.setDescription(
							`• ${member}, you just gained a level! Current Level : **${level.level}** •`
						);

					const DeveloperLogsEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setDescription(
							`• User: ${member} | Guild: ${guild.name} | Level: \`${level.level}\` | XP: \`${level.xp}\` •`
						);

					const DeveloperLogsChannel =
						guild.channels.cache.get(LevelUpChannelID);

					if (DeveloperLogsChannel) {
						DeveloperLogsChannel.send({ embeds: [DeveloperLogsEmbed] });
					}

					const LevelNotificationsData = await LevelNotificationsSchema.findOne(
						{
							guild: guild.id,
						}
					);

					if (LevelNotificationsData) {
						// Database information
						const LevelNotificationsChannel = guild.channels.cache.get(
							LevelNotificationsData.channel
						);
						const LevelNotificationsToggle =
							LevelNotificationsData.notifications;

						if (LevelNotificationsToggle) {
							if (LevelNotificationsChannel) {
								// Bot permissions
								const botPermissionsArry = ['SendMessages', 'ViewChannel'];
								const botPermissions = await permissionCheck(
									LevelNotificationsChannel,
									botPermissionsArry,
									client
								);

								if (!botPermissions[0])
									return await sendEmbed(
										await guild.fetchOwner(),
										`Bot Missing Permissions: \`${botPermissions[1]}\` in ${LevelNotificationsChannel}`
									);

								await LevelNotificationsChannel.send({
									embeds: [LevelUpEmbed],
								});
							} else {
								// Bot permissions
								const botPermissionsArry = ['SendMessages', 'ViewChannel'];
								const botPermissions = await permissionCheck(
									channel,
									botPermissionsArry,
									client
								);

								if (!botPermissions[0])
									return await sendEmbed(
										await guild.fetchOwner(),
										`Bot Missing Permissions: \`${botPermissions[1]}\` in ${channel}`
									);

								await channel.send({
									embeds: [LevelUpEmbed],
								});
							}
						}
					}
				}

				await level.save().catch((err) => {
					console.log(err);
				});
				// if (author.id == '387341502134878218') return;
				cooldowns.add(author.id);
				setTimeout(() => {
					cooldowns.delete(author.id);
				}, 30000);
			}
		} catch (error) {
			console.log(error);
		}
	},
};
