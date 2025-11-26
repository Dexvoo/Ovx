const { Events } = require('discord.js');
const { addUserVoiceXP } = require('../../utils/Functions/Levels/XP-Database.js');
const { validateXPPreconditions } = require('../../utils/Functions/Levels/XP-Validation.js');

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

    if (newState.channel) {
      const validationResult = await validateXPPreconditions(member, newState.channel);
      if (!validationResult) {
        if (client.voiceTracker.has(member.id)) {
          client.voiceTracker.delete(member.id);
        }
        return;
      }

      client.voiceTracker.set(member.id, {
        time: Date.now(),
        guildId: guild.id,
        levelConfig: validationResult.levelConfig,
        levelUpChannel: validationResult.levelUpChannel,
      });

      client.utils.LogData('Voice XP', `Tracking started for @${member.user.username}`, 'debug');
    }

    if (oldState.channel && !newState.channel) {
      const voiceData = client.voiceTracker.get(member.id);
      if (!voiceData) return;

      client.voiceTracker.delete(member.id);

      const timeInChannel = (Date.now() - voiceData.time) / 1000 / 60; // in minutes
      if (timeInChannel < 1)
        return client.utils.LogData('Voice XP', `Too short: @${member.user.username}`, 'debug');

      await addUserVoiceXP(member, voiceData.levelUpChannel, voiceData.levelConfig, timeInChannel);
    }
  },
};
