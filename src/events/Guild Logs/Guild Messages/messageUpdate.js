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
	name: Events.MessageUpdate,
	nickname: 'Message Logs',
	once: false,

	/**
	 *  @param {Message} oldMessage
	 * @param {Message} newMessage
	 */
	async execute(oldMessage, newMessage) {
		// Deconstructing message
		const { guild, client, member, channel, author, content, attachments, id } =
			oldMessage;

		if (author.bot || !guild) return;

		// Getting message logs data from database
		const MessageLogsData = await MessageLogs.findOne({
			guild: guild.id,
		});

		// Checking if the guild has a message logs set up
		if (!MessageLogsData) return;

		// Getting guild channel
		const channelToSend = guild.channels.cache.get(MessageLogsData.channel);

		// Checking if the channel exists
		if (!channelToSend) {
			await MessageLogs.findOneAndDelete({ guild: guild.id });
			await sendEmbed(
				await guild.fetchOwner(),
				`Message Logs Channel Deleted | Message Logs is now \`disabled\``
			);

			return;
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
			await MessageLogs.findOneAndDelete({ guild: guild.id });
			return await sendEmbed(
				await guild.fetchOwner(),
				`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${channelToSend} | Message Logs is now \`disabled\``
			);
		}

		const premiumRole = client.guilds.cache
			.get(DeveloperGuildID)
			.roles.cache.get(PremiumUserRoleID);

		const hasPremiumRole = premiumRole.members.has(author.id)
			? `• ${SuccessEmoji} •`
			: `• ${ErrorEmoji} •`;

		// Getting old message content
		var messageContentOld = content;
		if (content === '') {
			messageContentOld = 'No content';
		}

		// Getting new message content
		var messageContentNew = newMessage.content;
		if (newMessage.content === '') {
			messageContentNew = 'No content';
		}

		// Creating embed
		const Embed = new EmbedBuilder()
			.setTitle('Message Edited')
			.setColor('Orange')
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
					name: 'Before',
					value: `${messageContentOld}`,
				},
				{
					name: 'After',
					value: `${messageContentNew}`,
				},
				{
					name: 'ID`s',
					value: `\`\`\`ansi\n[2;31mUser | ${author.id}\n[2;36mMessage | ${newMessage.id}\n[2;34mGuild | ${guild.id}\`\`\``,
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
	},
};
