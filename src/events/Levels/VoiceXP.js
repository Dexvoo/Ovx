const { Events } = require('discord.js');
const { addUserVoiceXP } = require('../../utils/Functions/Levels/XP-Database.js');
const { validateXPPreconditions } = require('../../utils/Functions/Levels/XP-Validation.js');

const inVoiceChannelMembers = new Map();

module.exports = {
  name: Events.VoiceStateUpdate,
  once: false,
  nickname: 'Voice XP | Levels',

  /**
   * @param {import('../../types.js').VoiceUtils} oldState
   * @param {import('../../types.js').VoiceUtils} newState
   */
  async execute(oldState, newState) {
    const { client, guild, member } = newState;

    if (member.user.bot || !guild) return;

    // --- User JOINs or SWITCHES a channel ---
    if (newState.channel) {
      // Validate preconditions using the new channel
      const validationResult = await validateXPPreconditions(member, newState.channel);
      if (!validationResult) {
        // If they are blacklisted, ensure they are removed from tracking
        if (inVoiceChannelMembers.has(member.id)) {
          inVoiceChannelMembers.delete(member.id);
        }
        return;
      }

      // User joined a valid channel, start tracking them
      inVoiceChannelMembers.set(member.id, {
        time: Date.now(),
        guildId: guild.id,
        // Pass the validated config and channel for later use
        levelConfig: validationResult.levelConfig,
        levelUpChannel: validationResult.levelUpChannel,
      });
      client.utils.LogData(
        'Voice XP',
        `User @${member.user.username} joined VC #${newState.channel.name}. Tracking started.`,
        'debug'
      );
    }

    // --- User LEAVES a channel ---
    if (oldState.channel && !newState.channel) {
      const voiceData = inVoiceChannelMembers.get(member.id);
      if (!voiceData) return; // Not a tracked user

      // Stop tracking
      inVoiceChannelMembers.delete(member.id);

      const timeInChannel = (Date.now() - voiceData.time) / 1000 / 60; // in minutes
      if (timeInChannel < 1) {
        // Require at least 1 minute to earn XP
        return client.utils.LogData(
          'Voice XP',
          `User @${member.user.username} left VC too soon (${timeInChannel.toFixed(1)} mins).`,
          'debug'
        );
      }

      // Grant XP using the stored config and channel
      await addUserVoiceXP(member, voiceData.levelUpChannel, voiceData.levelConfig, timeInChannel);
      client.utils.LogData(
        'Voice XP',
        `User @${member.user.username} left VC. Granted XP for ${timeInChannel.toFixed(1)} mins.`,
        'info'
      );
    }
  },
};
