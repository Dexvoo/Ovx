const { Colors } = require('discord.js');
const { Giveaway } = require('../../models/GuildSetups');
const { endGiveaway } = require('./GiveawayManager');

module.exports = async function GiveawayEnd(interaction) {
  const { client, options } = interaction;
  const messageId = options.getString('message_id');

  const giveawayDoc = await Giveaway.findOne({
    messageId: messageId,
    guildId: interaction.guildId,
  });

  if (!giveawayDoc) {
    return client.utils.Embed(
      interaction,
      Colors.Red,
      'Not Found',
      'Could not find a giveaway with that message ID.'
    );
  }
  if (!giveawayDoc.isActive) {
    return client.utils.Embed(
      interaction,
      Colors.Orange,
      'Already Ended',
      'This giveaway has already ended.'
    );
  }

  await endGiveaway(giveawayDoc, client);
  return client.utils.Embed(
    interaction,
    Colors.Green,
    'Success',
    'The giveaway has been ended successfully.'
  );
};
