const { Colors } = require('discord.js');
const LogsCache = require('../../cache/Logs');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function LogsIgnoreView(interaction) {
  const { client, guildId } = interaction;

  const logsConfig = await LogsCache.get(guildId);
  const ignored = logsConfig.ignoredChannels;

  if (!ignored || ignored.length === 0) {
    return client.utils.Embed(
      interaction,
      Colors.Blurple,
      'Ignored Channels',
      'There are no channels on the log ignore list.'
    );
  }

  const description = ignored.map((id) => `<#${id}>`).join('\n');
  return client.utils.Embed(
    interaction,
    Colors.Blurple,
    'Ignored Channels',
    `The following channels are being ignored by the logging system:\n\n${description}`
  );
};
