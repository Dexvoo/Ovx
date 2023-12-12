const {
	EmbedBuilder,
	Events,
	Message,
	AuditLogEvent,
	GuildMember,
	Embed,
} = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../../utils/Checks.js');
const JoinLeaveLogs = require('../../../models/GuildJoinLeaveLogs.js');
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
	name: Events.GuildMemberRemove,
	nickname: 'Join/Leave Logs',
	once: false,

	/**
	 *  @param {GuildMember} member
	 */
	async execute(member) {
		// Deconstructing message
		const { guild, client, channel, user } = member;

		if (!guild) return;

		const JoinLeaveLogsData = await JoinLeaveLogs.findOne({
			guild: guild.id,
		});

		// Checking if the guild has a message logs set up
		if (!JoinLeaveLogsData) return;

		// Getting guild channel
		const guildChannel = guild.channels.cache.get(JoinLeaveLogsData.channel);

		// Checking if the guild channel exists
		if (!guildChannel) return;

		// Bot permissions
		const botPermissionsArry = ['ViewChannel', 'SendMessages'];
		const botPermissions = await permissionCheck(
			guildChannel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) {
			return await sendEmbed(
				await guild.fetchOwner(),
				`Bot Missing Permissions: \`${botPermissions[1]}\` in ${guildChannel} for \`Join/Leave Logs\``
			);
		}

		const premiumRole = client.guilds.cache
			.get(DeveloperGuildID)
			.roles.cache.get(PremiumUserRoleID);

		const hasPremiumRole = premiumRole.members.has(member.id)
			? `• ${SuccessEmoji} •`
			: `• ${ErrorEmoji} •`;

		// Account age in days
		const accountAge = `${Math.floor(
			(Date.now() - user.createdAt) / 86400000
		)} days`;
		const joinedAt = `<t:${Math.round(member.joinedTimestamp / 1000)}:F>`;
		let userRoles;
		if (member.roles.cache.size > 1) {
			userRoles = member.roles.cache
				.filter((role) => role.id !== guild.id)
				.map((role) => role.toString())
				.join(', ');
			if (userRoles.length > 1024) userRoles = 'Too many roles to display';
		} else {
			userRoles = 'None';
		}

		const JoinEmbed = new EmbedBuilder()
			.setColor('Red')
			.setTitle('Member Left')
			.addFields(
				{
					name: 'User',
					value: `@${user.username} (${member})`,
					inline: true,
				},
				{
					name: 'User Premium',
					value: `${hasPremiumRole}`,
					inline: true,
				},
				{
					name: 'Joined At',
					value: `${joinedAt}`,
					inline: false,
				},
				{
					name: 'Roles',
					value: `${userRoles}`,
				},
				{
					name: 'Account Age',
					value: `${accountAge}`,
					inline: true,
				},
				{
					name: 'Member Count',
					value: `${guild.memberCount}`,
					inline: true,
				},
				{
					name: "ID's",
					value: `\`\`\`ansi\n[0;31mUser | ${member.id}\n[0;34mGuild | ${guild.id}\`\`\``,
					inline: false,
				}
			)
			.setFooter({ text: FooterText, iconURL: FooterImage })
			.setTimestamp();

		await guildChannel.send({ embeds: [JoinEmbed] });
	},
};
