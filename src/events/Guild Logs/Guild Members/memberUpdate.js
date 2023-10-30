const { EmbedBuilder, Events, GuildMember } = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../../utils/Checks.js');
const {
	cleanConsoleLog,
	cleanConsoleLogData,
} = require('../../../utils/ConsoleLogs.js');
const MemberLogs = require('../../../models/GuildMemberLogs.js');
const { type } = require('os');
require('dotenv').config();
const {
	FooterImage,
	FooterText,
	DeveloperMode,
	PremiumUserRoleID,
	DeveloperGuildID,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;

module.exports = {
	name: Events.GuildMemberUpdate,
	nickname: 'Member Logs',

	/**
	 * @param {GuildMember} oldMember
	 * @param {GuildMember} newMember
	 */

	async execute(oldMember, newMember) {
		try {
			// Deconstructing channel
			const { guild, client } = newMember;

			// Checking for role changes
			// (This is a workaround for the fact that the roleUpdate event is not emitted when a member's roles change)
			const removedRoles = oldMember.roles.cache.filter(
				(role) => !newMember.roles.cache.has(role.id)
			);
			const addedRoles = newMember.roles.cache.filter(
				(role) => !oldMember.roles.cache.has(role.id)
			);
			if (removedRoles.size > 0 || addedRoles.size > 0) {
				return;
			}

			cleanConsoleLogData(
				'Member Update',
				`@${newMember.user.username}`,
				'info'
			);

			// Getting message logs data from database
			const MemberLogsData = await MemberLogs.findOne({
				guild: guild.id,
			});

			// Checking if the guild has a message logs set up
			if (!MemberLogsData) {
				cleanConsoleLogData(
					'Member Update',
					`Guild: ${guild.name} | Member Logs Not Setup`,
					'warning'
				);
				return;
			}

			// Getting guild channel
			const channelToSend = guild.channels.cache.get(MemberLogsData.channel);

			// Checking if the channel exists
			if (!channelToSend) {
				await MemberLogs.findOneAndDelete({ guildId: guild.id });
				cleanConsoleLogData(
					'Member Update',
					`Guild: ${guild.name} | Member Logs Channel Missing`,
					'warning'
				);
				return await sendEmbed(
					await guild.fetchOwner(),
					`Channel Missing: ${channelToSend} | Message Logs is now \`disabled\``
				).catch((err) => {});
			}

			// Bot permissions
			const botPermissionsArry = ['SendMessages', 'ViewChannel'];
			const botPermissions = await permissionCheck(
				channelToSend,
				botPermissionsArry,
				client
			);

			// Checking if the bot has permissions
			if (!botPermissions[0]) {
				await MemberLogs.findOneAndDelete({ guildId: guild.id });
				cleanConsoleLogData(
					'Member Update',
					`Guild: ${guild.name} | Incorrect Channel Permissions`,
					'warning'
				);
				return await sendEmbed(
					await guild.fetchOwner(),
					`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${channelToSend} | Message Logs is now \`disabled\``
				);
			}

			const premiumRole = client.guilds.cache
				.get(DeveloperGuildID)
				.roles.cache.get(PremiumUserRoleID);

			const hasPremiumRole = premiumRole.members.has(newMember.id)
				? `• ${SuccessEmoji} •`
				: `• ${ErrorEmoji} •`;

			// Started Embed
			const Embed = new EmbedBuilder()
				.setTitle(`Member Updated`)
				.setColor('Orange')
				.addFields(
					{
						name: `Member`,
						value: `@${newMember.user.username} (${newMember})`,
						inline: true,
					},
					{
						name: 'User Premium',
						value: `${hasPremiumRole}`,
						inline: true,
					}
				)
				.setFooter({ text: FooterText, iconURL: FooterImage })
				.setTimestamp();

			// Variables
			const currentTime = `<t:${Math.floor(Date.now() / 1000)}:R>`;

			const newMemberDisplayName =
				newMember.nickname || `@${newMember.user.username}`;
			const oldMemberDisplayName =
				oldMember.nickname || `@${oldMember.user.username}`;

			if (newMemberDisplayName !== oldMemberDisplayName) {
				Embed.addFields({
					name: 'Display Name Changed',
					value: `\`${oldMemberDisplayName}\` -> \`${newMemberDisplayName}\``,
					inline: false,
				});
			}

			// Checking if the member has changed avatar
			if (newMember.avatar !== oldMember.avatar) {
				const avatarURL =
					newMember.avatarURL({ dynamic: true, size: 1024 }) ||
					'No Avatar Found';

				if (avatarURL !== 'No Avatar Found') {
					Embed.setImage(avatarURL);
					Embed.addFields({
						name: 'Avatar Changed',
						value: `[Click Here](${avatarURL})`,
						inline: false,
					});
				} else {
					Embed.addFields({
						name: 'Avatar Changed',
						value: avatarURL,
						inline: false,
					});
				}
			}

			// Checking if the member has changed nitro status
			if (oldMember.premiumType !== newMember.premiumType) {
				Embed.addFields({
					name: 'Nitro Status Changed',
					value: `\`${oldMember.premiumType}\` -> \`${newMember.premiumType}\``,
					inline: false,
				});
			}

			// Checking if the member has
			if (oldMember.displayHexColor !== newMember.displayHexColor) {
				Embed.addFields({
					name: 'Accent Color Changed',
					value: `\`${oldMember.displayHexColor}\` -> \`${newMember.displayHexColor}\``,
					inline: false,
				});
			}

			// Checking if the member has changed flags
			if (oldMember.flags.bitfield !== newMember.flags.bitfield) {
				Embed.addFields({
					name: 'Flags Changed',
					value: `\`${oldMember.flags.bitfield}\` -> \`${newMember.flags.bitfield}\``,
					inline: false,
				});
			}

			// Adding last fields to embed
			Embed.addFields(
				{
					name: 'Updated At',
					value: currentTime,
				},
				{
					name: "ID's",
					value: `\`\`\`ansi\n[0;31mUser | ${newMember.id}\n[0;34mGuild | ${guild.id}\`\`\``,
				}
			);

			// Sending embed
			await channelToSend.send({ embeds: [Embed] });
		} catch (error) {
			console.error(error);
		}
	},
};
