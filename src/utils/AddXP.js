const {
	EmbedBuilder,
	CommandInteraction,
	PermissionFlagsBits,
	PermissionsBitField,
	GuildMember,
	VoiceBasedChannel,
	GuildChannel,
	Client,
	Guild,
	ChannelType,
} = require('discord.js');
require('dotenv').config();
const { EmbedColour, LevelUpChannelID } = process.env;
const { sendEmbed } = require('./Embeds.js');
const LevelsSchema = require('../models/GuildLevels.js');
const LevelNotificationsSchema = require('../models/LevelNotifications.js');
const { cleanConsoleLogData } = require('./ConsoleLogs.js');
const { calculateLevel, getLevelFromXP } = require('./XP.js');
const { permissionCheck } = require('./Checks.js');

/**
 * @param {GuildMember} member - GuildMember
 * @param {number} xp - XP
 * @param {GuildChannel | VoiceBasedChannel } channel - Channel
 */
const addUserXP = async (member, xp, channel) => {
	// Check for undefined
	if (!member) throw new Error('No member provided.');

	if (member instanceof GuildMember) {
		try {
			// Variables
			const { guild, user, client } = member;
			const query = { guildId: guild.id, userId: user.id };

			// Getting user level
			const level = await LevelsSchema.findOne(query);

			// If user has no level
			if (!level) {
				const newUserInformation = getLevelFromXP(xp);
				if (newUserInformation[0] == 0) {
					const newUserLevel = new LevelsSchema({
						userId: user.id,
						guildId: guild.id,
						xp: newUserInformation[1],
						level: newUserInformation[0],
					});
					await newUserLevel.save().catch((error) => console.log(error));
				} else {
					// Send level up message

					await sendLevelUpEmbed(
						member,
						newUserInformation[0],
						newUserInformation[1],
						channel
					);
				}
			} else {
				level.xp += xp;

				if (level.xp >= calculateLevel(level.level)) {
					level.level += 1;

					if (level.level >= 2) {
						level.xp = level.xp - calculateLevel(level.level) + 100;
					} else {
						level.xp = level.xp;
					}
					// send level up message
					await sendLevelUpEmbed(member, level.level, level.xp, channel);
				}

				await level.save().catch((err) => {
					console.log(err);
				});
			}
		} catch (error) {}
	} else {
		throw new Error('Invalid member provided.');
	}
};

module.exports = {
	addUserXP,
};

/**
 * @param {GuildMember} member - GuildMember
 * @param {number} level - Level
 * @param {number} xp - XP
 * @param {GuildChannel | VoiceBasedChannel } channel - Channel
 */

async function sendLevelUpEmbed(member, level, xp, channel) {
	const embed = new EmbedBuilder()
		.setColor(EmbedColour)
		.setDescription(
			`• ${member}, you just gained a level! Current Level : **${level}** •`
		);

	const { client, guild } = member;

	const DeveloperLogsEmbed = new EmbedBuilder()
		.setColor(EmbedColour)
		.setDescription(
			`• User: ${member} | Guild: ${guild.name} | Level: \`${level}\` | XP: \`${xp}\` •`
		);

	const DeveloperLogsChannel = client.channels.cache.get(LevelUpChannelID);
	if (DeveloperLogsChannel) {
		DeveloperLogsChannel.send({ embeds: [DeveloperLogsEmbed] });
	}

	/// Check if guild has level notifications enabled
	const levelNotifications = await LevelNotificationsSchema.findOne({
		guild: guild.id,
	});

	if (!levelNotifications) {
		// bot permissions
		const botPermissionsArray = ['SendMessages', 'ViewChannel'];
		const botPermissions = await permissionCheck(
			channel,
			botPermissionsArray,
			client
		).catch((error) => console.log(error));

		if (botPermissions[0] == false) {
			return;
		}

		await channel.send({ embeds: [embed] });
	} else {
		const LevelNotificationsChannel = guild.channels.cache.get(
			levelNotifications.channel
		);
		const LevelNotificationsToggle = levelNotifications.notifications;

		if (LevelNotificationsToggle) {
			if (LevelNotificationsChannel) {
				// Bot permissions
				const botPermissionsArry = ['SendMessages', 'ViewChannel'];
				const botPermissions = await permissionCheck(
					LevelNotificationsChannel,
					botPermissionsArry,
					client
				);

				if (!botPermissions[0]) {
					// delete database entry
					await LevelNotificationsSchema.deleteOne({
						guildId: guild.id,
					}).catch((error) => console.log(error));
					return;
				}

				await LevelNotificationsChannel.send({
					embeds: [embed],
				});
			} else {
				// Bot permissions
				const botPermissionsArry = ['SendMessages', 'ViewChannel'];
				const botPermissions = await permissionCheck(
					channel,
					botPermissionsArry,
					client
				);

				if (!botPermissions[0]) {
					// delete database entry
					await LevelNotificationsSchema.deleteOne({
						guildId: guild.id,
					}).catch((error) => console.log(error));
					return;
				}

				await channel.send({
					embeds: [embed],
				});
			}
		}
	}
}
