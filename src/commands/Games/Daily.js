const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { UserCurrency } = require('../../models/UserCurrency');
const { TopggAPIKey, PublicClientID } = process.env;

module.exports = {
    cooldown: 5,
    category: 'Economy',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward')
        .setContexts( InteractionContextType.Guild, InteractionContextType.PrivateChannel, InteractionContextType.BotDM ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;

        // check if user voted for the bot on top gg
        const voted = await fetch(`https://top.gg/api/bots/${PublicClientID}/check?userId=${user.id}`, {
            headers: {
                'Authorization': TopggAPIKey
            }});

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Vote')
            .setURL(`https://top.gg/bot/${PublicClientID}/vote`)
        );

        if(!voted) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`You need to vote for the bot on top.gg to claim your daily reward!`);
            return await interaction.reply({ embeds: [Embed], components: [button] });
        }
        const votedJson = await voted.json();

        if(!votedJson.voted) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`You need to vote for the bot on top.gg to claim your daily reward!`);
            return await interaction.reply({ embeds: [Embed], components: [button] });
        }

        var userCurrency = await UserCurrency.findOne({ userId: user.id });
 
        if(!userCurrency) {
            userCurrency = new UserCurrency({
                userId: user.id,
            });
            await userCurrency.save();
        }
        
        const currentTime = new Date();
        const lastClaimed = new Date(userCurrency.dailyLastClaimed);
        const nextClaim = new Date(lastClaimed.getFullYear(), lastClaimed.getMonth(), lastClaimed.getDate() + 1, 0, 0, 0);
        const todaysClaim = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() + 1, 0, 0, 0);
        
        if(lastClaimed.getDate() === currentTime.getDate()) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`Please wait until tomorrow to claim your daily reward | ${getDiscordTimestamp(nextClaim)}`)
                .setFooter({ text: `Streak: ${userCurrency.dailyStreak}` });
            return await interaction.reply({ embeds: [Embed] });
        }

        userCurrency.dailyLastClaimed = currentTime;

        if(currentTime.getDate() - lastClaimed.getDate() >= 2) {

            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`You have missed a day, your daily streak has been reset | ${getDiscordTimestamp(todaysClaim)}`)
                .setFooter({ text: `Old Streak: ${userCurrency.dailyStreak}` });
            await interaction.reply({ embeds: [Embed] });

            userCurrency.dailyStreak = 0;
            await userCurrency.save();
            return
        }

        userCurrency.dailyStreak++;
        const reward = calculateDailyReward(userCurrency.dailyStreak);
        userCurrency.cash += reward;

        await userCurrency.save();

        const DailyEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(`You have claimed your daily reward of ${reward} coins! | ${getDiscordTimestamp(todaysClaim)}`)
            .setFooter({ text: `Streak: ${userCurrency.dailyStreak}` });

        await interaction.reply({ embeds: [DailyEmbed] });

    }

};


function getDiscordTimestamp (date) {
    return `<t:${Math.floor(new Date(date).getTime() / 1000)}:R>`;
}


function calculateDailyReward(streak) {
    const baseReward = 100;
    const streakBonus = 20;
    const MaxReward = 5000;

    let randomFactor = Math.random() * 0.2 - 0.1;
    let reward = baseReward + (streakBonus * (streak - 1))

    reward = Math.floor(reward + (reward * randomFactor));

    if(reward > MaxReward) {
        reward = MaxReward;
    }

    if(reward < baseReward) {
        reward = baseReward;
    }

    return reward;
}