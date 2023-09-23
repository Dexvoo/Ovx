const {
	EmbedBuilder,
	Events,
	Message,
	AuditLogEvent,
	GuildChannel,
	ChannelType,
	GuildMember,
} = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../../utils/Checks.js');
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
		console.log(`Guild Member Update Event Triggered`);
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

		// Getting message logs data from database
		const MemberLogsData = await MemberLogs.findOne({
			guild: guild.id,
		});

		// Checking if the guild has a message logs set up
		if (!MemberLogsData) return;

		// Getting guild channel
		const channelToSend = guild.channels.cache.get(MemberLogsData.channel);

		// Checking if the channel exists
		if (!channelToSend) {
			await MemberLogs.findOneAndDelete({ guildId: guild.id });
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

		// Checking if the user has a new avatar
		if (oldMember.nickname !== newMember.nickname) {
			if (oldMember.nickname === null)
				oldMember.nickname = `@${oldMember.user.username}`;
			if (newMember.nickname === null)
				newMember.nickname = `@${newMember.user.username}`;
			Embed.addFields({
				name: 'Nickname Changed',
				value: `\`${oldMember.nickname}\` -> \`${newMember.nickname}\``,
				inline: false,
			});
		}

		// Checking if the user has a new banner
		if (oldMember.user.banner !== newMember.user.banner) {
			Embed.addFields({
				name: 'Banner Changed',
				value: `Old Banner: ${oldMember.user.bannerURL({
					format: 'png',
					size: 4096,
				})}\nNew Banner: ${newMember.user.bannerURL({
					format: 'png',
					size: 4096,
				})}`,
				inline: false,
			});

			Embed.setImage(newMember.user.bannerURL({ format: 'gif', size: 1024 }));
		}

		// Adding last fields to embed
		Embed.addFields(
			{
				name: 'Updated At',
				value: currentTime,
			},
			{
				name: "ID's",
				value: `\`\`\`User | ${newMember.id}\nGuild | ${guild.id}\`\`\``,
			}
		);

		// Sending embed
		await channelToSend.send({ embeds: [Embed] });
	},
};
