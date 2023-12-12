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
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs.js');
const UserLevels = require('../../../models/GuildLevels.js');
const { getRandomXP, getLevelFromXP } = require('../../../utils/XP.js');
const { addUserXP } = require('../../../utils/AddXP.js');

const inVoiceChannelMembers = new Map();

module.exports = {
	name: Events.VoiceStateUpdate,
	nickname: 'Voice Level XP',
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

		if (guild.id !== '1115336808834805780') return;

		// Check if the user has joined the voice channel
		if (!oldState.channel && newState.channel) {
			inVoiceChannelMembers.set(user.id, {
				channel: newState.channel,
				time: Date.now(),
			});
			cleanConsoleLogData(
				'Voice Log',
				`Joined Voice Channel ${newState.channel.name}`,
				'debug'
			);
		}

		// Check if the user has left the voice channel
		if (oldState.channel && !newState.channel) {
			// check if the user is in the map
			if (!inVoiceChannelMembers.has(user.id)) return;

			const userData = await UserLevels.findOne({
				userId: user.id,
				guildId: guild.id,
			});

			if (!userData) return;

			const timeInVoiceChannel =
				Date.now() - inVoiceChannelMembers.get(user.id).time;

			const timeInVoiceChannelSeconds = Math.floor(timeInVoiceChannel / 1000);
			const timeInVoiceChannelMinutes = Math.floor(
				timeInVoiceChannelSeconds / 60
			);

			// give a random amount of xp between 5 and 15 for every minute spent in the voice channel
			const xp = getRandomXP(5, 15) * timeInVoiceChannelMinutes;
			if (xp !== 0) {
				cleanConsoleLogData(
					'Voice XP',
					`User: @${member.user.username} | Added XP: ${xp}`,
					'debug'
				);

				// add time spent in voice channel to user
				userData.voice += timeInVoiceChannelMinutes;

				await userData.save().catch((err) => {
					console.log(err);
				});

				await addUserXP(member, xp, oldState.channel);
			} else {
				cleanConsoleLogData('Voice Log', 'No XP gained', 'debug');
			}

			// add xp to user

			inVoiceChannelMembers.delete(user.id);

			cleanConsoleLogData(
				'Voice Log',
				`Left Voice Channel: ${oldState.channel.name} | Time: ${timeInVoiceChannelSeconds} seconds`,
				'debug'
			);
		}

		// Check if the channel has changed, if there is a new channel, it means the user has switched channels, otherwise they disconnected
		if (oldState.channel !== newState.channel) {
			if (newState.channel !== null && oldState.channel !== null) {
				cleanConsoleLogData(
					'Voice Log',
					`Switched Voice Channels: #${oldState.channel.name} -> #${newState.channel.name}`,
					'debug'
				);
			}
		}
	},
};
