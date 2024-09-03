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
const XPBoostersSchema = require('../models/GuildXPBoosters.js');

/**
 * @param {GuildMember} member - GuildMember
 * @param {number} xp - XP
 * @param {GuildChannel | VoiceBasedChannel } channel - Channel
 */
const addUserXP = async (member, xp, channel) => {
	if (!member) throw new Error('No member provided.');

	if (member instanceof GuildMember) {
		try {
			const { guild, user, client } = member;
			const query = { guildId: guild.id, userId: user.id };

			let levelData = await LevelsSchema.findOne(query);

			if (!levelData) {
				const [newLevel, remainingXP] = getLevelFromXP(xp);
				levelData = new LevelsSchema({
					userId: user.id,
					guildId: guild.id,
					xp: remainingXP,
					level: newLevel,
				});
				await levelData.save();
				if (newLevel > 0) {
					await sendLevelUpEmbed(member, newLevel, remainingXP, channel);
				}
			} else {
				levelData.xp += xp;

				let levelUpOccurred = false;
				while (levelData.xp >= calculateLevel(levelData.level + 1)) {
					levelUpOccurred = true;
					levelData.level += 1;
					levelData.xp -= calculateLevel(levelData.level);

					await sendLevelUpEmbed(member, levelData.level, levelData.xp, channel);
					await giveLevelRewards(member, levelData.level);
				}

				if (levelUpOccurred) {
					await levelData.save();
				}
			}
		} catch (error) {
			console.error(error);
		}
	} else {
		throw new Error('Invalid member provided.');
	}
};


/**
 * @param {GuildMember} member - GuildMember
 */

async function xpBoosterPercentage(member) {
	if (!member) throw new Error('No member provided.');

	if (member instanceof GuildMember) {
		try {
			const { guild } = member;
			const fetchedMember = await guild.members.fetch({ user: member.id, force: true }).catch((error) => console.log(error));
			
			let xp = 0;
			const query = { guildId: guild.id };
			const xpBoosterRoles = await XPBoostersSchema.findOne(query);

			if (!xpBoosterRoles) return xp;
			if (!xpBoosterRoles.guildData.length) return xp;

			for (const data of xpBoosterRoles.guildData) {
				const role = guild.roles.cache.get(data.roleId);
				if (!role) {
					await XPBoostersSchema.findOneAndUpdate(
						{ guildId: guild.id },
						{ $pull: { guildData: { roleId: data.roleId } } }
					);
					continue;
				}

				if (fetchedMember.roles.cache.has(data.roleId)) xp += data.percentage;
			}

			return xp;

		} catch (error) {
			console.error(error);
		}

	} else {
		throw new Error('Invalid member provided.');
	}


}

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
			var roles = rewards.filter((role) => role.level <= newLevel);

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
							roles.splice(roles.indexOf(data), 1);
							cleanConsoleLogData(
								'Level Rewards',
								'Role no longer exists, deleting data in database',
								'error'
							);
							await LevelRewardsSchema.findOneAndUpdate(
								{ guildId: guild.id },
								{ $pull: { rewards: { role: data.role } } }
							);
						}
					} catch (error) {
						console.log(error);
					}
				})
			);
			// Add all roles to user at once
			await member.roles.add(roles.map((data) => data.role));

			console.log('Added roles');
		} catch (error) {}
	} else {
		throw new Error('Invalid member provided.');
	}
};

module.exports = {
	addUserXP,
	giveLevelRewards,
	xpBoosterPercentage,
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
