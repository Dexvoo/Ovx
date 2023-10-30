const {
	EmbedBuilder,
	Events,
	Message,
	AuditLogEvent,
	GuildChannel,
	ChannelType,
	Role,
} = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../../utils/Checks.js');
const RoleLogs = require('../../../models/GuildRoleLogs.js');
const { type } = require('os');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs.js');
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
	name: Events.GuildRoleCreate,
	nickname: 'Role Logs',

	/**
	 *  @param {Role} role
	 */
	async execute(role) {
		// Deconstructing channel
		const { guild, client, type, name, id } = role;

		if (!guild) return;

		// get a random channel from the guild
		const channel = guild.channels.cache.random();

		// Bot permissions
		const botPermissionsArry = ['ViewAuditLog'];
		const botPermissions = await permissionCheck(
			channel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) {
			return await sendEmbed(
				await guild.fetchOwner(),
				`Bot Missing Permissions: \`${botPermissions[1]}\` | Role Logs`
			);
		}

		try {
			guild
				.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 })
				.then(async (audit) => {
					// Deconstructing audit
					console.log(audit);
					// Getting message logs data from database
					const RoleLogsData = await RoleLogs.findOne({
						guild: guild.id,
					});

					// Checking if the guild has a message logs set up
					if (!RoleLogsData) return;

					// Getting guild channel
					const channelToSend = guild.channels.cache.get(RoleLogsData.channel);

					// Bot permissions
					const botPermissionsArry = ['SendMessages', 'ViewChannel'];
					const botPermissions = await permissionCheck(
						channelToSend,
						botPermissionsArry,
						client
					);

					// Checking if the bot has permissions
					if (!botPermissions[0]) {
						await RoleLogs.findOneAndDelete({ guildId: guild.id });
						return await sendEmbed(
							await guild.fetchOwner(),
							`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${channelToSend} | Role Logs is now \`disabled\``
						);
					}

					// Checking if the channel exists
					if (!channelToSend) {
						await RoleLogs.findOneAndDelete({ guildId: guild.id });
						return;
					}

					// Variables
					const currentTime = `<t:${Math.floor(Date.now() / 1000)}:R>`;

					const Embed = new EmbedBuilder()
						.setTitle(`Role Created`)
						.setColor('Green')
						.addFields(
							{
								name: `Role`,
								value: `${role} (${role.id})`,
								inline: true,
							},
							{
								name: 'Created By',
								value: `( Not Found )`,
							},
							{
								name: 'Created At',
								value: currentTime,
							},
							{
								name: "ID's",
								value: `\`\`\`ansi\n[2;36mRole | ${role.id}\n[2;34mGuild | ${guild.id}\`\`\``,
							}
						)
						.setFooter({ text: FooterText, iconURL: FooterImage })
						.setTimestamp();

					// Sending embed
					await channelToSend.send({ embeds: [Embed] });
				})
				.catch((err) => {
					console.log(err);
				});
		} catch (error) {
			console.log(error);
		}
	},
};
