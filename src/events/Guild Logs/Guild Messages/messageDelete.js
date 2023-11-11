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

		// Bot permissions
		const botPermissionsArry = ['ViewAuditLog'];
		const botPermissions = await permissionCheck(
			channel,
			botPermissionsArry,
			client
		);

		if (!botPermissions[0]) {
			cleanConsoleLogData(
				'Message Deleted',
				`Guild: ${guild.name} | Message Logs | Incorrect Channel Permissions`,
				'warning'
			);
			return await sendEmbed(
				await guild.fetchOwner(),
				`Bot Missing Permissions: \`${botPermissions[1]}\``
			);
		}

		try {
			await guild
				.fetchAuditLogs({
					type: AuditLogEvent.MessageDelete,
					limit: 1,
				})
				.then(async (audit) => {
					// Deconstructing audit
					// const
					var { executor, target, createdAt, changes, actionType, extra } =
						audit.entries.first();

					if (audit.entries.first() === undefined) {
						executor = author;
					}

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
					const channelToSend = guild.channels.cache.get(
						MessageLogsData.channel
					);

					// Bot permissions
					const botPermissionsArry = ['SendMessages', 'ViewChannel'];
					const botPermissions = await permissionCheck(
						channelToSend,
						botPermissionsArry,
						client
					);

					// Checking if the bot has permissions
					if (!botPermissions[0]) {
						await MessageLogs.findOneAndDelete({ guildId: guild.id });
						cleanConsoleLogData(
							'Message Deleted',
							`Guild: ${guild.name} | Message Logs | Incorrect Channel Permissions`,
							'warning'
						);
						return await sendEmbed(
							await guild.fetchOwner(),
							`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${channelToSend} | Message Logs is now \`disabled\``
						);
					}

					// Checking if the channel exists
					if (!channelToSend) {
						cleanConsoleLogData(
							'Message Deleted',
							`Guild: ${guild.name} | Message Logs Channel Deleted`,
							'warning'
						);
						await MessageLogs.findOneAndDelete({ guildId: guild.id });
						return;
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
								value: `<#${channel.id}>`,
							},
							{
								name: 'Content',
								value: `${messageContent}`,
							}
						)
						.setFooter({ text: FooterText, iconURL: FooterImage })
						.setTimestamp();

					var deletedBy;
					if (executor.username == author.username) {
						deletedBy = `\`@${author.username}\` (<@${author.id}>)`;
					} else {
						deletedBy = `\`@${executor.username}\` (<@${executor.id}>) or \`@${author.username}\` (${author})`;
					}

					cleanConsoleLogData(
						'Message Deleted',
						`User: @${author.username} Guild: ${guild.name}`,
						'info'
					);

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
				});
		} catch (error) {
			console.log(error);
		}
	},
};
