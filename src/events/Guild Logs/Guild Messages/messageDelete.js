const { EmbedBuilder, Events, Message, AuditLogEvent } = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../../utils/Checks.js');
const MessageLogs = require('../../../models/GuildMessageLogs.js');
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
			return await sendEmbed(
				await guild.fetchOwner(),
				`Bot Missing Permissions: \`${botPermissions[1]}\``
			);
		}

		try {
			guild
				.fetchAuditLogs({ type: AuditLogEvent.MessageDelete })
				.then(async (audit) => {
					// Deconstructing audit
					const { executor, target, createdAt } = audit.entries.first();

					// Getting message logs data from database
					const MessageLogsData = await MessageLogs.findOne({
						guild: guild.id,
					});

					// Checking if the guild has a message logs set up
					if (!MessageLogsData) return;

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
						return await sendEmbed(
							await guild.fetchOwner(),
							`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${channelToSend} | Message Logs is now \`disabled\``
						);
					}

					// Checking if the channel exists
					if (!channelToSend) {
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
							},
							{
								name: 'Deleted By',
								value: `${executor}`,
							},
							{
								name: "ID's",
								value: `\`\`\`User | ${author.id}\nMessage | ${id}\`\`\``,
							}
						)
						.setFooter({ text: FooterText, iconURL: FooterImage })
						.setTimestamp();

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
