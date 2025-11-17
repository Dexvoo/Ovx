const { Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { Giveaway } = require('../../models/GuildSetups');
const ms = require('ms');

module.exports = async function GiveawayCreate(interaction) {
    const { client, options, guild, channel, member } = interaction;

    const durationStr = options.getString('duration');
    const prize = options.getString('prize');
    const winnerCount = options.getInteger('winners') || 1;
    const requiredRole = options.getRole('role');
    const host = options.getUser('host') || member.user;

    const durationMs = ms(durationStr);
    if (!durationMs || durationMs < 60000) { // Minimum 1 minute
        return client.utils.Embed(interaction, Colors.Red, 'Invalid Duration', 'Please provide a valid duration (e.g., `10m`, `1h`, `2d`). Minimum is 1 minute.');
    }

    const endsAt = new Date(Date.now() + durationMs);

    const embed = new EmbedBuilder()
        .setTitle(`🎁 ${prize} 🎁`)
        .setColor(Colors.Blurple)
        .setDescription(`React with 🎉 to enter!\n**Ends:** ${client.utils.Timestamp(endsAt, 'R')} (${client.utils.Timestamp(endsAt, 'F')})\n**Hosted by:** ${host}`)
        .setFooter({ text: `Winners: ${winnerCount} | Entrants: 0` });

    if (requiredRole) {
        embed.addFields({ name: 'Requirement', value: `You must have the ${requiredRole} role to enter.` });
    }

    const button = new ButtonBuilder()
        .setCustomId('giveaway-enter')
        .setLabel('Enter')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎉');

    const row = new ActionRowBuilder().addComponents(button);

    const giveawayMessage = await channel.send({ embeds: [embed], components: [row] });
    // Now we update the customId to be unique
    button.setCustomId(`giveaway-enter.${giveawayMessage.id}`);
    await giveawayMessage.edit({ components: [new ActionRowBuilder().addComponents(button)] });


    const newGiveaway = new Giveaway({
        guildId: guild.id,
        messageId: giveawayMessage.id,
        channelId: channel.id,
        prize: prize,
        endsAt: endsAt,
        winnerCount: winnerCount,
        hostId: host.id,
        requiredRoleId: requiredRole?.id || null,
    });

    await newGiveaway.save();

    return client.utils.Embed(interaction, Colors.Green, 'Giveaway Created!', `The giveaway for **${prize}** has been started in ${channel}.`);
};