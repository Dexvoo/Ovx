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
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs.js');
const UserLevels = require('../../../models/GuildLevels.js');
const { getRandomXP, getLevelFromXP } = require('../../../utils/XP.js');
const { addUserXP } = require('../../../utils/AddXP.js');

// Map to store user voice channel data
const inVoiceChannelMembers = new Map();

// Cache for user data
const userDataCache = new Map();

// Batch updates queue
const batchUpdatesQueue = [];

module.exports = {
    name: Events.VoiceStateUpdate,
    nickname: 'Voice Level XP',
    once: false,

    /**
     *  @param {VoiceState} oldState
     * @param {VoiceState} newState
     */
    async execute(oldState, newState) {
        const { channel, client, guild, member } = newState;
        const user = member.user;

        if (!guild || user.bot) return;
        if (guild.id !== DeveloperGuildID) return;

        // Handle user joining voice channel
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
            return;
        }

        // Handle user leaving voice channel
        if (oldState.channel && !newState.channel) {
            if (!inVoiceChannelMembers.has(user.id)) return;

            const joinData = inVoiceChannelMembers.get(user.id);
            const timeInVoiceChannel = Date.now() - joinData.time;
            const timeInVoiceChannelMinutes = Math.floor(timeInVoiceChannel / 1000 / 60);

            // If time spent is less than a minute, do not award XP
            if (timeInVoiceChannelMinutes < 1) {
				console.log(`User ${user.username} spent less than a minute in voice channel.`);
                inVoiceChannelMembers.delete(user.id);
                return;
            }

            let userData = userDataCache.get(user.id);
            if (!userData) {
                userData = await UserLevels.findOne({
                    userId: user.id,
                    guildId: guild.id,
                });
                userDataCache.set(user.id, userData);
            }

            if (!userData) return;

            const xp = getRandomXP(5, 15) * timeInVoiceChannelMinutes;
            if (xp !== 0) {

                // Update user data in cache
                userData.voice += timeInVoiceChannelMinutes;
                userDataCache.set(user.id, userData);

                // Queue the update to be batched later
                batchUpdatesQueue.push({ user: member, xp, channel: oldState.channel });
            }

            inVoiceChannelMembers.delete(user.id);
            cleanConsoleLogData(
                'Voice Log',
                `Left Voice Channel: ${oldState.channel.name} | Time: ${timeInVoiceChannel} milliseconds`,
                'debug'
            );
            return;
        }

        // Handle user switching voice channels
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

// Batch process queued updates every 5 minutes
setInterval(async () => {
    while (batchUpdatesQueue.length > 0) {
		console.log(`Processing ${batchUpdatesQueue.length} queued XP updates...`);
        const { user, xp, channel } = batchUpdatesQueue.shift();
        const userData = userDataCache.get(user.id);
        try {
            await userData.save();
            await addUserXP(user, xp, channel);
            userDataCache.delete(user.id);
			cleanConsoleLogData(
				'Voice XP',
				`User: @${user.username} | Added XP: ${xp}`,
				'debug'
			);
        } catch (err) {
            console.log(err);
        }
    }
}, 5 * 60 * 1000); // 5 minutes
