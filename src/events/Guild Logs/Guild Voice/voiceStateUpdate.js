const {
	EmbedBuilder,
	PermissionsBitField,
	Events,
	GuildMember,
	VoiceState,
} = require('discord.js');
const {
	FooterText,
	FooterImage,
	EmbedColour,
	VoiceChannelID,
	DeveloperGuildID,
	PremiumUserRoleID,
	DeveloperMode,
	SuccessEmoji,
	ErrorEmoji,
} = process.env;
const VoiceLogs = require('../../../models/GuildVoiceLogs.js');
const { sendEmbed } = require('../../../utils/Embeds.js');
const { permissionCheck } = require('../../../utils/Checks.js');

module.exports = {
	name: Events.VoiceStateUpdate,
	nickname: 'Voice Logs',
	once: false,

	/**
	 *  @param {VoiceState} oldState
	 * @param {VoiceState} newState
	 */

	async execute(oldState, newState) {
		// Deconstructing member
		const { channel, client, guild, member } = newState;
		const user = member.user;

		if (!guild || user.bot) return;

		// Getting message logs data from database
		const VoiceLogsData = await VoiceLogs.findOne({
			guild: guild.id,
		});

		// Checking if the guild has a message logs set up
		if (!VoiceLogsData) return;

		const channelToSend = client.channels.cache.get(VoiceLogsData.channel);

		if (!channelToSend)
			return await VoiceLogs.findOneAndDelete({ guildId: guild.id });

		// Bot permissions
		const botPermissionsArry = ['SendMessages', 'ViewChannel'];
		const botPermissions = await permissionCheck(
			channelToSend,
			botPermissionsArry,
			client
		);

		// Checking if the bot has permissions
		if (!botPermissions[0]) {
			await VoiceLogs.findOneAndDelete({ guildId: guild.id });
			return await sendEmbed(
				await guild.fetchOwner(),
				`Bot Missing Permissions: \`${botPermissions[1]}\` in channel : ${channelToSend} | Voice Logs is now \`disabled\``
			);
		}
		const premiumRole = client.guilds.cache
			.get(DeveloperGuildID)
			.roles.cache.get(PremiumUserRoleID);

		const hasPremiumRole = premiumRole.members.has(user.id)
			? `• ${SuccessEmoji} •`
			: `• ${ErrorEmoji} •`;

		const VoiceLogEmbed = new EmbedBuilder()
			.setTitle('Voice Log')
			.setColor(EmbedColour)
			.addFields(
				{
					name: 'User',
					value: `@${user.username} (${member})`,
					inline: true,
				},
				{
					name: 'User Premium',
					value: `${hasPremiumRole}`,
					inline: true,
				}
			)
			.setFooter({ text: FooterText, iconURL: FooterImage })
			.setTimestamp();

		var channelID;
		if (oldState.channel !== null) {
			channelID = oldState.channel.id;
		}

		if (newState.channel !== null) {
			channelID = newState.channel.id;
		}

		// Check if the user has joined the voice channel
		if (!oldState.channel && newState.channel) {
			VoiceLogEmbed.addFields({
				name: 'Action',
				value: `Joined Voice Channel: ${newState.channel}`,
			});
		}

		// Check if the user has left the voice channel
		if (oldState.channel && !newState.channel) {
			VoiceLogEmbed.addFields({
				name: 'Action',
				value: `Left Voice Channel: ${oldState.channel}`,
			});
		}

		// Check if the user has been deafened or undeafened
		if (
			oldState.serverDeaf !== newState.serverDeaf &&
			oldState.channel !== null
		) {
			VoiceLogEmbed.addFields({
				name: 'Action',
				value: `${
					newState.serverDeaf ? 'Server Deafened' : 'Server Undeafened'
				}`,
			});
		}

		// Check if the user has been server muted or unmuted
		if (
			oldState.serverMute !== newState.serverMute &&
			oldState.channel !== null
		) {
			VoiceLogEmbed.addFields({
				name: 'Action',
				value: `${newState.serverMute ? 'Server Muted' : 'Server Unmuted'}`,
			});
		}

		// Check if the channel has changed, if there is a new channel, it means the user has switched channels, otherwise they disconnected
		if (oldState.channel !== newState.channel) {
			if (newState.channel !== null && oldState.channel !== null) {
				VoiceLogEmbed.addFields({
					name: 'Action',
					value: `Switched Voice Channels: ${oldState.channel} -> ${newState.channel}`,
				});
			}
		}

		// Check if the user has turn on video
		if (
			oldState.selfVideo !== newState.selfVideo &&
			oldState.channel !== null
		) {
			VoiceLogEmbed.addFields({
				name: 'Action',
				value: `${newState.selfVideo ? 'Turned on video' : 'Turned off video'}`,
			});
		}

		// Check if the user has turned on Screen Share
		if (
			oldState.streaming !== newState.streaming &&
			oldState.channel !== null
		) {
			VoiceLogEmbed.addFields({
				name: 'Action',
				value: `${
					newState.streaming
						? 'Turned on Screen Share'
						: 'Turned off Screen Share'
				}`,
			});
		}

		VoiceLogEmbed.addFields({
			name: 'ID`s',
			value: `\`\`\`ansi\n[2;31mUser | ${user.id}\n[2;36mChannel | ${channelID}\n[2;34mGuild | ${guild.id}[0m\`\`\``,
		});

		// Check if the embed has 3 fields, if it does, it means the embed is is empty and should not be sent
		if (VoiceLogEmbed.data.fields.length === 3) return;

		await channelToSend.send({ embeds: [VoiceLogEmbed] });
	},
};
