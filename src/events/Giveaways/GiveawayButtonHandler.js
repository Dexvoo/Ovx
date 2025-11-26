const { Events, Colors } = require('discord.js');
const { Giveaway } = require('../../models/GuildSetups');

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  nickname: 'Giveaway Button Handler',

  async execute(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('giveaway-enter')) return;

    const { client, customId, member, guild } = interaction;
    const messageId = customId.split('.')[1];
    if (!messageId) return;

    await interaction.deferReply({ ephemeral: true });

    const giveaway = await Giveaway.findOne({ messageId: messageId, guildId: guild.id });

    if (!giveaway) {
      return client.utils.Embed(
        interaction,
        Colors.Red,
        'Giveaway Not Found',
        'This giveaway could not be found in the database. It might be corrupted or deleted.'
      );
    }
    if (!giveaway.isActive) {
      return client.utils.Embed(
        interaction,
        Colors.Red,
        'Giveaway Ended',
        'This giveaway has already ended.'
      );
    }
    if (giveaway.entrants.includes(member.id)) {
      return client.utils.Embed(
        interaction,
        Colors.Orange,
        'Already Entered',
        'You have already entered this giveaway.'
      );
    }
    if (giveaway.requiredRoleId && !member.roles.cache.has(giveaway.requiredRoleId)) {
      return client.utils.Embed(
        interaction,
        Colors.Red,
        'Permission Denied',
        `You need the <@&${giveaway.requiredRoleId}> role to enter this giveaway.`
      );
    }

    try {
      await Giveaway.updateOne({ messageId: messageId }, { $addToSet: { entrants: member.id } });

      // Update the embed footer with the new entrant count
      const message = await interaction.channel.messages.fetch(messageId);
      if (message && message.embeds.length > 0) {
        const newEntrantCount = giveaway.entrants.length + 1;
        const updatedEmbed = message.embeds[0];
        updatedEmbed.footer.text = `Winners: ${giveaway.winnerCount} | Entrants: ${newEntrantCount}`;
        await message.edit({ embeds: [updatedEmbed] });
      }

      return client.utils.Embed(
        interaction,
        Colors.Green,
        'Entry Confirmed!',
        `You have successfully entered the giveaway for the **${giveaway.prize}**.`
      );
    } catch (error) {
      client.utils.LogData(
        'Giveaway Entry',
        `Failed to add entrant ${member.id} to giveaway ${messageId}: ${error}`,
        'error'
      );
      return client.utils.Embed(
        interaction,
        Colors.Red,
        'Error',
        'An error occurred while trying to enter you into the giveaway.'
      );
    }
  },
};
