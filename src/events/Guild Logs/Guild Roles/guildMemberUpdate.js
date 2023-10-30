const {
	EmbedBuilder,
	PermissionsBitField,
	Events,
	GuildMember,
} = require('discord.js');
const {
	FooterText,
	FooterImage,
	EmbedColour,
	DeveloperGuildID,
	PremiumUserRoleID,
	DeveloperMode,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;
const RoleLogs = require('../../../models/GuildRoleLogs.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { permissionCheck } = require('../../../utils/Checks.js');

module.exports = {
	name: Events.GuildMemberUpdate,
	nickname: 'Role Logs',

	/**
	 *  @param {GuildMember} oldMember
	 * @param {GuildMember} newMember
	 */

	async execute(oldMember, newMember) {
		// Deconstructing member
		const { guild, client, user } = newMember;

		if (!guild || user.bot) return;

		const RoleLogsData = await RoleLogs.findOne({
			guild: guild.id,
		});

		if (!RoleLogsData) return;

		const channelToSend = guild.channels.cache.get(RoleLogsData.channel);

		if (!channelToSend) {
			await RoleLogs.findOneAndDelete({
				guild: guild.id,
			});
			return;
		}

		// Bot permissions
		const botPermissionsArry = ['ViewChannel', 'SendMessages'];
		const botPermissions = await permissionCheck(
			channelToSend,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) {
			return await sendEmbed(
				await guild.fetchOwner(),
				`Bot Missing Permissions: \`${botPermissions[1]}\` | Role Logs are now \`disabled\``
			);
		}

		const removedRoles = oldMember.roles.cache.filter(
			(role) => !newMember.roles.cache.has(role.id)
		);

		const addedRoles = newMember.roles.cache.filter(
			(role) => !oldMember.roles.cache.has(role.id)
		);

		const premiumRole = client.guilds.cache
			.get(DeveloperGuildID)
			.roles.cache.get(PremiumUserRoleID);

		const hasPremiumRole = premiumRole.members.has(newMember.id)
			? `• ${SuccessEmoji} •`
			: `• ${ErrorEmoji} •`;

		const RolesLogEmbed = new EmbedBuilder()
			.setTitle('Roles Log')
			.setColor(EmbedColour)
			.addFields(
				{
					name: 'User',
					value: `@${user.username} (${oldMember})`,
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

		var roleID;
		if (removedRoles.size > 0) {
			roleID = removedRoles.map((r) => r.id);
			RolesLogEmbed.addFields({
				name: 'Roles Removed',
				value: `${removedRoles.map((r) => r.name) || 'None'} ${ErrorEmoji}`,
			});
		}
		if (addedRoles.size > 0) {
			roleID = addedRoles.map((r) => r.id);
			RolesLogEmbed.addFields({
				name: 'Roles Added',
				value: `${addedRoles.map((r) => r.name) || 'None'} ${SuccessEmoji}`,
			});
		}

		if (removedRoles.size < 1 && addedRoles.size < 1) return;

		RolesLogEmbed.addFields({
			name: 'ID`s',
			value: `\`\`\`ansi\n[2;31mUser | ${user.id}\n[2;36mRole | ${roleID}\n[2;34mGuild | ${guild.id}\`\`\``,
		});
		await channelToSend.send({ embeds: [RolesLogEmbed] });
	},
};
