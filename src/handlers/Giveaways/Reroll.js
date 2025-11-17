const { Colors } = require('discord.js');
const { Giveaway } = require('../../models/GuildSetups');

module.exports = async function GiveawayReroll(interaction) {
    const { client, options, channel } = interaction;
    const messageId = options.getString('message_id');

    const giveawayDoc = await Giveaway.findOne({ messageId: messageId, guildId: interaction.guildId });

    if (!giveawayDoc) {
        return client.utils.Embed(interaction, Colors.Red, 'Not Found', 'Could not find a giveaway with that message ID.');
    }
    if (giveawayDoc.isActive) {
        return client.utils.Embed(interaction, Colors.Orange, 'Still Active', 'This giveaway has not ended yet. End it first before rerolling.');
    }
    if (giveawayDoc.entrants.length === 0) {
        return client.utils.Embed(interaction, Colors.Orange, 'No Entrants', 'There were no entrants to reroll from.');
    }

    const eligibleEntrants = giveawayDoc.entrants.filter(e => !giveawayDoc.winners.includes(e));
    if (eligibleEntrants.length === 0) {
        return client.utils.Embed(interaction, Colors.Orange, 'No Reroll Candidates', 'All entrants have already won!');
    }

    const newWinner = eligibleEntrants[Math.floor(Math.random() * eligibleEntrants.length)];

    // Update DB
    giveawayDoc.winners.push(newWinner);
    await Giveaway.updateOne({ messageId: messageId }, { $push: { winners: newWinner } });

    await channel.send({ content: `Reroll! The new winner for the **${giveawayDoc.prize}** is ${newWinner}! Congratulations!`, reply: { messageReference: messageId } });
    return client.utils.Embed(interaction, Colors.Green, 'Success', `A new winner has been chosen.`);
};