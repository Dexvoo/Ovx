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
	name: Events.MessageBulkDelete,
	nickname: 'Message Logs',

	/**
	 *  @param {Message} oldMessage
	 */
	async execute(messages, channel) {
		console.log('messages', messages);
		// Deconstructing channel
		const { guild, client, content, attachments, id } = channel;

		if (!guild) return;

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
				.fetchAuditLogs({ type: AuditLogEvent.MessageBulkDelete })
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

					// How to get content of bulk deleted messages

					const premiumRole = client.guilds.cache
						.get(DeveloperGuildID)
						.roles.cache.get(PremiumUserRoleID);

					const hasPremiumRole = premiumRole.members.has(executor.id)
						? `• ${SuccessEmoji} •`
						: `• ${ErrorEmoji} •`;

					// Creating embed
					const Embed = new EmbedBuilder()
						.setTitle('Message Bulk Deleted')
						.setColor('Orange')
						.addFields(
							{
								name: 'Channel',
								value: `<#${id}>`,
							},
							{
								name: 'Messages Deleted',
								value: `${messages.size}`,
							},
							{
								name: 'Deleted By',
								value: `${executor}`,
							},
							{
								name: "ID's",
								value: `\`\`\`User | ${executor.id}\nMessage | ${id}\`\`\``,
							}
						)
						.setFooter({ text: FooterText, iconURL: FooterImage })
						.setTimestamp();

					// Sending embed
					await channelToSend.send({ embeds: [Embed] });
				});
		} catch (error) {
			console.log(error);
		}
	},
};
