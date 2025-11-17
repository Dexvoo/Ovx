const { Giveaway } = require('../../models/GuildSetups');
const { EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CHECK_INTERVAL = 15000; // 15 seconds

/**
 * The main function to end a giveaway. Can be called automatically or by command.
 * @param {import('../../models/Giveaway').GiveawayType} giveawayDoc The giveaway document from MongoDB.
 * @param {import('../../structures/OvxClient')} client The Discord client.
 */
async function endGiveaway(giveawayDoc, client) {
    const guild = client.guilds.cache.get(giveawayDoc.guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(giveawayDoc.channelId);
    if (!channel) return;
    const message = await channel.messages.fetch(giveawayDoc.messageId).catch(() => null);
    if (!message) return;

    const entrants = giveawayDoc.entrants;
    const winnerCount = giveawayDoc.winnerCount;
    const winners = [];

    if (entrants.length > 0) {
        const shuffled = entrants.sort(() => 0.5 - Math.random());
        winners.push(...shuffled.slice(0, winnerCount));
    }

    // Update DB
    giveawayDoc.isActive = false;
    giveawayDoc.winners = winners;
    await giveawayDoc.save();

    const host = await client.users.fetch(giveawayDoc.hostId).catch(() => ({ tag: 'Unknown Host' }));

    const endEmbed = EmbedBuilder.from(message.embeds[0])
        .setColor(Colors.Gold)
        .setDescription(`**Giveaway Ended!**\nHosted by: ${host}`)
        .setFields([]) // Clear old fields
        .setFooter({ text: `Winners: ${winnerCount} | Ended` });

    if (winners.length > 0) {
        endEmbed.addFields({ name: '🏆 Winners', value: winners.map(id => `<@${id}>`).join('\n') });
        await channel.send({ content: `Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won the **${giveawayDoc.prize}**!`, reply: { messageReference: message } });
    } else {
        endEmbed.addFields({ name: '😢 No Winners', value: 'There were no entrants.' });
        await channel.send({ content: `The giveaway for the **${giveawayDoc.prize}** has ended with no entrants.`, reply: { messageReference: message } });
    }

    // Disable the button
    const disabledButton = ButtonBuilder.from(message.components[0].components[0]).setDisabled(true);
    await message.edit({ embeds: [endEmbed], components: [new ActionRowBuilder().addComponents(disabledButton)] });
}

/**
 * Starts the interval to check for ended giveaways.
 * @param {import('../../structures/OvxClient')} client
 */
function start(client) {
    setInterval(async () => {
        try {
            const endedGiveaways = await Giveaway.find({
                isActive: true,
                endsAt: { $lte: new Date() },
            });

            if (endedGiveaways.length > 0) {
                client.utils.LogData('GiveawayManager', `Found ${endedGiveaways.length} ended giveaways to process.`, 'info');
                for (const giveaway of endedGiveaways) {
                    await endGiveaway(giveaway, client);
                }
            }
        } catch (error) {
            client.utils.LogData('GiveawayManager', `Error checking for ended giveaways: ${error}`, 'error');
        }
    }, CHECK_INTERVAL);
}

module.exports = { start, endGiveaway };