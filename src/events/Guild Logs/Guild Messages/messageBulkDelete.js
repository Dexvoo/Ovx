const {
	EmbedBuilder,
	Events,
	Message,
	AuditLogEvent,
	GuildTextBasedChannel,
} = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../../utils/Checks.js');
const MessageLogs = require('../../../models/GuildMessageLogs.js');
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
	name: Events.MessageBulkDelete,
	nickname: 'Message Logs',

	/**
	 *  @param {Message} messages
	 * @param {GuildTextBasedChannel} channel
	 */
	async execute(messages, channel) {
		// Deconstructing channel
		const { guild, client, content, attachments, id } = channel;

		if (!guild) return;

		// Getting message logs data from database
		const MessageLogsData = await MessageLogs.findOne({
			guild: guild.id,
		});

		// Checking if the guild has a message logs set up
		if (!MessageLogsData)
			return cleanConsoleLogData(
				'Message Bulk Deleted',
				`Guild: ${guild.name} | Message Logs Not Setup`,
				'warning'
			);

		// Getting guild channel
		const channelToSend = guild.channels.cache.get(MessageLogsData.channel);

		// Checking if the channel exists
		if (!channelToSend) {
			cleanConsoleLogData(
				'Message Bulk Deleted',
				`Guild: ${guild.name} | Message Logs Channel Deleted`,
				'error'
			);
			await MessageLogs.findOneAndDelete({ guildId: guild.id });
			return;
		}

		// Bot permissions
		const botPermissionsArry = ['SendMessages', 'ViewChannel', 'ViewAuditLog'];
		const botPermissions = await permissionCheck(
			channelToSend,
			botPermissionsArry,
			client
		);

		// Checking if the bot has permissions
		if (!botPermissions[0]) {
			for (let i = 0; i < botPermissions[1].length; i++) {
				if (botPermissions[1][i] !== 'ViewAuditLog') {
					cleanConsoleLogData(
						'Message Bulk Deleted',
						`Guild: ${guild.name} | Missing Permissions`,
						'warning'
					);
					await MessageLogs.findOneAndDelete({ guildId: guild.id });
					await sendEmbed(
						await guild.fetchOwner(),
						`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${channelToSend} | Message Logs is now \`disabled\``
					);
					return;
				}
			}
		}

		// Creating embed
		const Embed = new EmbedBuilder()
			.setTitle('Message Bulk Deleted')
			.setColor('Orange')
			.addFields(
				{
					name: 'Channel',
					value: `<#${channel.id}>`,
				},
				{
					name: 'Messages Deleted',
					value: `${messages.size}`,
				}
			)
			.setFooter({ text: FooterText, iconURL: FooterImage })
			.setTimestamp();

		if (botPermissions[0]) {
			const entry = await guild
				.fetchAuditLogs({ type: AuditLogEvent.MessageBulkDelete, limit: 1 })
				.then((audit) => audit.entries.first())
				.catch((err) => {
					console.log(err);
				});
			console.log(entry);

			Embed.addFields(
				{
					name: 'Deleted By',
					value: `${entry.executor}`,
					inline: true,
				},
				{
					name: 'Reason',
					value: `${entry.reason || 'No Reason Provided'}`,
					inline: true,
				},
				{
					name: "ID's",
					value: `\`\`\`ansi\n[2;31mUser | ${entry.executor.id}\n[2;36mChannel | ${channel.id}\n[2;34mGuild | ${channel.guild.id}\`\`\``,
				}
			);
		} else {
			Embed.addFields(
				{
					name: 'Deleted By',
					value: `Missing \`ViewAuditLog\` Permission`,
					inline: true,
				},
				{
					name: 'Reason',
					value: `Missing \`ViewAuditLog\` Permission`,
					inline: true,
				},
				{
					name: "ID's",
					value: `\`\`\`ansi\n[2;36mChannel | ${channel.id}\n[2;34mGuild | ${channel.guild.id}\`\`\``,
				}
			);
		}

		await channelToSend.send({ embeds: [Embed] });
	},
};
