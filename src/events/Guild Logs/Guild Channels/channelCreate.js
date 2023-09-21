const {
	EmbedBuilder,
	Events,
	Message,
	AuditLogEvent,
	GuildChannel,
	ChannelType,
} = require('discord.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../../utils/Checks.js');
const ChannelLogs = require('../../../models/GuildChannelLogs.js');
const { type } = require('os');
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
	name: Events.ChannelCreate,
	nickname: 'Channel Logs',

	/**
	 *  @param {GuildChannel} channel
	 */
	async execute(channel) {
		// Deconstructing channel
		const { guild, client, type, name, id } = channel;

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
				.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate })
				.then(async (audit) => {
					// Deconstructing audit
					const { executor, target, createdAt } = audit.entries.first();

					// Getting message logs data from database
					const ChannelLogsData = await ChannelLogs.findOne({
						guild: guild.id,
					});

					// Checking if the guild has a message logs set up
					if (!ChannelLogsData) return;

					// Getting guild channel
					const channelToSend = guild.channels.cache.get(
						ChannelLogsData.channel
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
						await ChannelLogs.findOneAndDelete({ guildId: guild.id });
						return await sendEmbed(
							await guild.fetchOwner(),
							`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${channelToSend} | Message Logs is now \`disabled\``
						);
					}

					// Checking if the channel exists
					if (!channelToSend) {
						await ChannelLogs.findOneAndDelete({ guildId: guild.id });
						return;
					}

					// Variables
					let type = channel.type;
					if (type == ChannelType.GuildAnnouncement) type = 'Announcement';
					if (type == ChannelType.GuildText) type = 'Text';
					if (type == ChannelType.GuildVoice) type = 'Voice';
					if (type == ChannelType.GuildStore) type = 'Store';
					if (type == ChannelType.GuildCategory) type = 'Category';
					if (type == ChannelType.GuildStageVoice) type = 'Stage Voice';
					if (type == ChannelType.PublicThread) type = 'Public Thread';
					if (type == ChannelType.PrivateThread) type = 'Private Thread';
					if (type == ChannelType.GuildStageVoice) type = 'Stage Voice';
					const currentTime = `<t:${Math.floor(Date.now() / 1000)}:R>`;

					const Embed = new EmbedBuilder()
						.setTitle(`${type} Channel Created`)
						.setColor('Green')
						.addFields(
							{
								name: `Channel`,
								value: `${channel} (${id})`,
								inline: true,
							},
							{
								name: 'Created By',
								value: `@${executor.username} (<@${executor.id}>)`,
							},
							{
								name: 'Created At',
								value: currentTime,
							},
							{
								name: "ID's",
								value: `\`\`\`User | ${executor.id}\nChannel | ${id}\`\`\``,
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
