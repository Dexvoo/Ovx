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
 * @param {GuildChannel} channel - Channel
 */
const addUserXP = async (member, xp, channel) => {
	// Check for undefined
	if (!member) throw new Error('No member provided.');

	if (member instanceof GuildMember) {
		try {
			// Variables
			const { guild, user, client } = member;
			const query = { guildId: guild.id, userId: user.id };

			if (guild.id !== '1115336808834805780') return;
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
					// await userLevelUp(
					// 	member,
					// 	newUserInformation[0],
					// 	newUserInformation[1],
					// 	channel
					// );
				}
			} else {
				cleanConsoleLogData(
					'Voice XP',
					`OLD LEVEL DATA | LEVEL : ${level.level} | XP : ${level.xp}`,
					'warning'
				);
				level.xp += xp;
				if (level.xp >= calculateLevel(level.level)) {
					level.level += 1;

					if (level.level >= 2) {
						level.xp = level.xp - calculateLevel(level.level) + 100;
					} else {
						level.xp = level.xp;
					}
					cleanConsoleLogData(
						'Voice XP',
						`NEW LEVEL DATA | LEVEL : ${level.level} | XP : ${level.xp}`,
						'warning'
					);
					// send level up message
					await sendLevelUpEmbed(member, level.level, xp, channel);
				}
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
 * @param {GuildChannel} channel - Channel
 */

async function sendLevelUpEmbed(member, level, xp, channel) {
	const embed = new EmbedBuilder()
		.setColor(EmbedColour)
		.setDescription(
			`• ${member}, you just gained a level! Current Level : **${level}** •`
		);

	const { client, guild } = member;

	// bot permissions
	const botPermissionsArray = ['SendMessages', 'ViewChannel'];
	const botPermissions = await permissionCheck(
		channel,
		botPermissionsArray,
		client
	).catch((error) => console.log(error));

	if (botPermissions[0] == false) {
		return console.log(
			`Bot does not have the following permissions in ${channel.name} : ${botPermissions[1]}`
		);
	}

	await channel.send({ embeds: [embed] });
}
