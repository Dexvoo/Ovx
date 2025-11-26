//--\events\StartingFiles\VoiceXPInit.js
const { Events, ChannelType } = require('discord.js');
const { validateXPPreconditions } = require('../../utils/Functions/Levels/XP-Validation.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  nickname: 'Voice XP Initializer',

  /**
   * @param {import('../../structures/OvxClient')} client
   */
  async execute(client) {
    client.utils.LogData('Voice XP Init', 'Scanning for active voice users...', 'info');

    let count = 0;

    for (const guild of client.guilds.cache.values()) {
      const voiceChannels = guild.channels.cache.filter(
        (c) => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice
      );

      for (const voiceChannel of voiceChannels.values()) {
        for (const [memberId, member] of voiceChannel.members) {
          if (member.user.bot) continue;

          const validationResult = await validateXPPreconditions(member, voiceChannel);
          if (validationResult) {
            client.voiceTracker.set(memberId, {
              time: Date.now(),
              guildId: guild.id,
              levelConfig: validationResult.levelConfig,
              levelUpChannel: validationResult.levelUpChannel,
            });
            count++;
          }
        }
      }
    }

    client.utils.LogData('Voice XP Init', `Resumed tracking for ${count} users.`, 'success');
  },
};
