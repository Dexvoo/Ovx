const { EmbedBuilder, Events, Message, AuditLogEvent } = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../../utils/Checks.js');
const MessageLogs = require('../../../models/GuildMessageLogs.js');
const { sleep, cleanConsoleLogData } = require('../../../utils/ConsoleLogs.js');
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
	name: Events.MessageDelete,
	nickname: 'Message Logs',

	/**
	 *  @param {Message} message
	 */
	async execute(message) {
		// Deconstructing message
		const { guild, client, member, channel, author, content, attachments, id } =
			message;

		if (author.bot || !guild) return;

		// Getting message logs data from database
		const MessageLogsData = await MessageLogs.findOne({
			guild: guild.id,
		});

		// Checking if the guild has a message logs set up
		if (!MessageLogsData)
			return cleanConsoleLogData(
				'Message Deleted',
				`Guild: ${guild.name} | Message Logs Not Setup`,
				'warning'
			);
		// Getting guild channel
		const channelToSend = guild.channels.cache.get(MessageLogsData.channel);

		// Checking if the channel exists
		if (!channelToSend) {
			cleanConsoleLogData(
				'Message Deleted',
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
						'Message Deleted',
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

		const premiumRole = client.guilds.cache
			.get(DeveloperGuildID)
			.roles.cache.get(PremiumUserRoleID);

		const hasPremiumRole = premiumRole.members.has(author.id)
			? `• ${SuccessEmoji} •`
			: `• ${ErrorEmoji} •`;

		var messageContent = content;
		if (content === '') {
			messageContent = 'No content';
		}

		const Embed = new EmbedBuilder()
			.setTitle('Message Deleted')
			.setColor('Red')
			.addFields(
				{
					name: `User's Message`,
					value: `@${author.username} (<@${author.id}>)`,
					inline: true,
				},
				{
					name: 'User Premium',
					value: `${hasPremiumRole}`,
					inline: true,
				},
				{
					name: 'Channel',
					value: `<#${channel.id || '0'}>`,
				},
				{
					name: 'Content',
					value: `${messageContent}`,
				}
			)
			.setFooter({ text: FooterText, iconURL: FooterImage })
			.setTimestamp();

		cleanConsoleLogData(
			'Message Deleted',
			`User: @${author.username} Guild: ${guild.name}`,
			'info'
		);

		var deletedBy = `Missing \`ViewAuditLog\` Permission`;

		if (botPermissions[0]) {
			const entry = await guild
				.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 1 })
				.then((audit) => audit.entries.first())
				.catch((err) => {
					console.log(err);
				});

			if (
				entry.extra.channel.id === message.channel.id &&
				//Then we are checking if the target is the same as the author id
				entry.target.id === message.author.id &&
				// We are comparing time as audit logs are sometimes slow.
				entry.createdTimestamp > Date.now() - 5000 &&
				// We want to check the count as audit logs stores the amount deleted in a channel
				entry.extra.count >= 1
			) {
				deletedBy = `\`@${entry.executor.username}\` (${entry.executor})`;
			} else {
				deletedBy = `\`@${author.username}\` (${author})`;
			}
		}

		Embed.addFields(
			{
				name: 'Deleted By',
				value: deletedBy,
			},
			{
				name: "ID's",
				value: `\`\`\`ansi\n[2;31mUser | ${author.id}\n[2;36mMessage | ${message.id}\n[2;34mGuild | ${guild.id}\`\`\``,
			}
		);

		// Getting attachments and sending them
		if (attachments.size > 0) {
			Array.from(attachments.values());
			const data = [...attachments.values()];
			await channelToSend.send({ embeds: [Embed], files: data });
			return;
		}

		// Sending embed
		await channelToSend.send({ embeds: [Embed] });
	},
};
