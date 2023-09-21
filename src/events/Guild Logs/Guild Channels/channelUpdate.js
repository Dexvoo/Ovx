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
	name: Events.ChannelUpdate,
	nickname: 'Channel Logs',

	/**
	 *  @param {GuildChannel} oldChannel
	 * @param {GuildChannel} newChannel
	 */
	async execute(oldChannel, newChannel) {
		// Deconstructing channel
		const { guild, client, type } = newChannel;

		if (!guild) return;

		// Bot permissions
		const botPermissionsArry = ['ViewAuditLog'];
		const botPermissions = await permissionCheck(
			newChannel,
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
				.fetchAuditLogs({ type: AuditLogEvent.ChannelUpdate })
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
					let oldType = oldChannel.type;
					let oldTypeText = '';
					if (oldType == ChannelType.GuildAnnouncement)
						oldTypeText = 'Announcement';
					if (oldType == ChannelType.GuildText) oldTypeText = 'Text';
					if (oldType == ChannelType.GuildVoice) oldTypeText = 'Voice';
					if (oldType == ChannelType.GuildStore) oldTypeText = 'Store';
					if (oldType == ChannelType.GuildCategory) oldTypeText = 'Category';
					if (oldType == ChannelType.GuildStageVoice)
						oldTypeText = 'Stage Voice';
					if (oldType == ChannelType.PublicThread)
						oldTypeText = 'Public Thread';
					if (oldType == ChannelType.PrivateThread)
						oldTypeText = 'Private Thread';
					if (oldType == ChannelType.GuildStageVoice)
						oldTypeText = 'Stage Voice';

					let newType = newChannel.type;
					let newTypeText = '';
					if (newType == ChannelType.GuildAnnouncement)
						newTypeText = 'Announcement';
					if (newType == ChannelType.GuildText) newTypeText = 'Text';
					if (newType == ChannelType.GuildVoice) newTypeText = 'Voice';
					if (newType == ChannelType.GuildStore) newTypeText = 'Store';
					if (newType == ChannelType.GuildCategory) newTypeText = 'Category';
					if (newType == ChannelType.GuildStageVoice)
						newTypeText = 'Stage Voice';
					if (newType == ChannelType.PublicThread)
						newTypeText = 'Public Thread';
					if (newType == ChannelType.PrivateThread)
						newTypeText = 'Private Thread';
					if (newType == ChannelType.GuildStageVoice)
						newTypeText = 'Stage Voice';

					// Started Embed
					const Embed = new EmbedBuilder()
						.setTitle(`${newTypeText} Channel Updated`)
						.setColor('Green')
						.addFields({
							name: `Channel`,
							value: `${newChannel} (${newChannel.id})`,
							inline: true,
						})
						.setFooter({ text: FooterText, iconURL: FooterImage })
						.setTimestamp();

					// Variables
					const currentTime = `<t:${Math.floor(Date.now() / 1000)}:R>`;

					// Checking if the channel type changed
					if (oldType != newType) {
						Embed.addFields({
							name: 'Type',
							value: `${oldTypeText} -> ${newTypeText}`,
						});
					}

					// Checking if the channel name changed
					if (oldChannel.name != newChannel.name) {
						Embed.addFields({
							name: 'Name',
							value: `${oldChannel.name} -> ${newChannel.name}`,
						});
					}

					// Checking if the channel topic changed
					if (oldChannel.topic != newChannel.topic) {
						if (oldChannel.topic === undefined)
							oldChannel.topic = 'No topic set';
						if (newChannel.topic === undefined)
							newChannel.topic = 'No topic set';

						Embed.addFields({
							name: 'Topic',
							value: `${oldChannel.topic} -> ${newChannel.topic}`,
						});
					}

					// Checking if the channel nsfw changed
					var oldnsfw = oldChannel.nsfw;
					var newnsfw = newChannel.nsfw;

					if (oldnsfw != newnsfw) {
						if (oldnsfw === false) oldnsfw = `• ${ErrorEmoji} •`;
						if (oldnsfw === true) oldnsfw = `• ${SuccessEmoji} •`;
						if (newnsfw === false) newnsfw = `• ${ErrorEmoji} •`;
						if (newnsfw === true) newnsfw = `• ${SuccessEmoji} •`;

						console.log(oldnsfw);
						console.log(newnsfw);

						Embed.addFields({
							name: 'NSFW',
							value: `${oldnsfw} -> ${newnsfw}`,
						});
					}

					// Checking if the channel bitrate changed
					var oldBitrate = oldChannel.bitrate;
					var newBitrate = newChannel.bitrate;
					if (oldBitrate != newBitrate) {
						if (oldBitrate === undefined) oldBitrate = 'No bitrate set';
						if (newBitrate === undefined) newBitrate = 'No bitrate set';
						Embed.addFields({
							name: 'Bitrate',
							value: `${oldBitrate} -> ${newBitrate}`,
						});
					}

					// Checking if the channel user limit changed
					var oldUserLimit = oldChannel.userLimit;
					var newUserLimit = newChannel.userLimit;
					if (oldUserLimit != newUserLimit) {
						if (oldUserLimit === undefined) oldUserLimit = 'No user limit set';
						if (newUserLimit === undefined) newUserLimit = 'No user limit set';
						Embed.addFields({
							name: 'User Limit',
							value: `${oldUserLimit} -> ${newUserLimit}`,
						});
					}

					// Checking if the channel rate limit per user changed
					var oldSlowmode = oldChannel.rateLimitPerUser;
					var newSlowmode = newChannel.rateLimitPerUser;
					if (oldSlowmode != newSlowmode) {
						console.log('oldSlowmode', oldSlowmode);
						console.log('newSlowmode', newSlowmode);
						if (oldSlowmode == undefined) oldSlowmode = 'No Slowmode';
						if (newSlowmode == undefined) newSlowmode = 'No Slowmode';
						Embed.addFields({
							name: 'Slowmode',
							value: `${oldSlowmode} -> ${newSlowmode}`,
						});
					}

					// Checking if the channel position changed
					if (oldChannel.position != newChannel.position) {
						return;
					}

					// Checking if the channel parent changed
					var oldParent = oldChannel.parent.name;
					var newParent = newChannel.parent.name;
					if (oldParent != newParent) {
						if (oldParent === undefined) oldParent = 'No parent set';
						if (newParent === undefined) newParent = 'No parent set';
						Embed.addFields({
							name: 'Parent',
							value: `${oldParent} -> ${newParent}`,
						});
					}

					Embed.addFields(
						{
							name: 'Updated By',
							value: `@${executor.username} (<@${executor.id}>)`,
						},
						{
							name: 'Updated At',
							value: currentTime,
						},
						{
							name: "ID's",
							value: `\`\`\`User | ${executor.id}\nChannel | ${newChannel.id}\`\`\``,
						}
					);

					// Sending embed
					await channelToSend.send({ embeds: [Embed] });
				});
		} catch (error) {
			console.log(error);
		}
	},
};
