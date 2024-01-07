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
	name: Events.ChannelDelete,
	nickname: 'Channel Logs',
	once: false,

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
				.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete })
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
					const currentTime = `<t:${Math.floor(Date.now() / 1000)}:R>`;
					let TypeText = '';
					switch (channel.type) {
						case ChannelType.GuildAnnouncement:
							TypeText = 'Announcement';
							break;
						case ChannelType.GuildForum:
							TypeText = 'Forum';
							break;
						case ChannelType.GuildText:
							TypeText = 'Text';
							break;
						case ChannelType.GuildVoice:
							TypeText = 'Voice';
							break;
						case ChannelType.GuildStore:
							TypeText = 'Store';
							break;
						case ChannelType.GuildCategory:
							TypeText = 'Category';
							break;
						case ChannelType.GuildStageVoice:
							TypeText = 'Stage Voice';
							break;
						case ChannelType.PublicThread:
							TypeText = 'Public Thread';
							break;
						case ChannelType.PrivateThread:
							TypeText = 'Private Thread';
							break;
						case ChannelType.GuildStageVoice:
							TypeText = 'Stage Voice';
							break;
					}

					const Embed = new EmbedBuilder()
						.setTitle(`${TypeText} Channel Deleted`)
						.setColor('Red')
						.addFields(
							{
								name: `Channel`,
								value: `#${channel.name} (${id})`,
								inline: true,
							},
							{
								name: 'Deleted By',
								value: `@${executor.username} (<@${executor.id}>)`,
							},
							{
								name: 'Deleted At',
								value: currentTime,
							},
							{
								name: "ID's",
								value: `\`\`\`ansi\n[2;31mUser | ${executor.id}\n[2;36mChannel | ${id}\n[2;34mGuild | ${guild.id}\`\`\``,
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
