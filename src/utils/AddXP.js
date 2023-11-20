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
const LevelRewardsSchema = require('../models/GuildLevelRewards.js');
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
					await giveLevelRewards(member, level.level);
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

/**
 * @param {GuildMember} member - GuildMember
 * @param {number} newLevel - Number
 */
const giveLevelRewards = async (member, newLevel) => {
	if (!member) throw new Error('No member provided.');
	if (!newLevel) throw new Error('No newLevel provided.');

	if (member instanceof GuildMember) {
		try {
			const { guild, user, client } = member;

			const query = { guildId: guild.id };
			const levelRewards = await LevelRewardsSchema.findOne(query);

			if (!levelRewards) return;

			const rewards = levelRewards.rewards;

			if (!rewards.length) {
				// delete data in database
				await LevelRewardsSchema.deleteOne({
					guildId: guild.id,
				}).catch((error) => console.log(error));
				return;
			}

			// get all roles that are below the new level
			const roles = rewards.filter((role) => role.level <= newLevel);

			// if no roles are below the new level
			if (!roles.length) return;

			// Attempt to add roles and check if the user already has the role
			await Promise.all(
				roles.map(async (data) => {
					try {
						const guildRole =
							guild.roles.cache.get(data.role) ||
							(await guild.roles.fetch(data.role));
						if (!guildRole) {
							// guild has deleted the role
							// remove role from database
							cleanConsoleLogData(
								'Level Rewards',
								'Role no longer exists, deleting data in database',
								'error'
							);
							await LevelRewardsSchema.findOneAndUpdate(
								{ guildId: guild.id },
								{ $pull: { rewards: { role: data.role } } }
							);
							return;
						}

						if (member.roles.cache.has(guildRole.id)) return;

						await member.roles
							.add(guildRole)
							.then(() => {
								cleanConsoleLogData(
									'Level Rewards',
									`Added Role: ${guildRole.name} to @${member.user.tag}`
								);
							})
							.catch(async (error) => {
								cleanConsoleLogData(
									'Level Rewards',
									`Failed to add Role: ${guildRole.name} to @${member.user.tag}`,
									'error'
								);
								// remove role from database
								await LevelRewardsSchema.findOneAndUpdate(
									{ guildId: guild.id },
									{ $pull: { rewards: { role: data.role } } }
								).catch((error) => console.log(error));
							});
					} catch (error) {
						console.log(error);
					}
				})
			);
		} catch (error) {}
	} else {
		throw new Error('Invalid member provided.');
	}
};

module.exports = {
	addUserXP,
	giveLevelRewards,
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

	if (!levelNotifications) return;

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
