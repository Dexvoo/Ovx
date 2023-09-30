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
				},
				{
					name: 'Guild',
					value: `${guild.name} (${guild.id})`,
				}
			)
			.setFooter({ text: FooterText, iconURL: FooterImage })
			.setTimestamp();

		if (removedRoles.size > 0) {
			RolesLogEmbed.addFields({
				name: 'Roles Removed',
				value: `${removedRoles.map((r) => r.name) || 'None'} ${ErrorEmoji}`,
			});
		}
		if (addedRoles.size > 0) {
			RolesLogEmbed.addFields({
				name: 'Roles Added',
				value: `${addedRoles.map((r) => r.name) || 'None'} ${SuccessEmoji}`,
			});
		}

		if (removedRoles.size < 1 && addedRoles.size < 1)
			return console.log('No roles were added or removed | Guild Roles');

		await channelToSend.send({ embeds: [RolesLogEmbed] });
	},
};
