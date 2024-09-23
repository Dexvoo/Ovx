const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, User } = require('discord.js');
const { UserCurrency } = require('../../models/UserCurrency');

const choices = [
    { name: 'Rock', beats: 'Scissors', emoji: '🪨' },
    { name: 'Paper', beats: 'Rock', emoji: '🧻' },
    { name: 'Scissors', beats: 'Paper', emoji: '✂️' },
]

const messages = {
    InvalidAmount: 'The amount must be greater than 0',
    UserNotEnoughCash: 'You don\'t have enough cash',
    GameOver: 'Game over, {user} did not respond in time',
    BotChallenge: 'You have challenged the bot to a coinflip for {amount} cash!',
    BotWin: `You lost {amount} cash!\n\nYou : {choice} \nBot : {botChoice}`,
    BotLose: `You won {amount} cash!\n\nYou : {choice} \nBot : {botChoice}`,
    UserNoBot: `You can't bet against a bot`,
    UserNoSelf: `You can't bet against yourself`,
    TargetNotEnoughCash: `The target user doesn't have enough cash`,
    UserChallenge: `{target}, you have been challenged to a game of Rock, Paper, or Scissors by {user} for {amount} cash! To play pick one of the buttons below`,
    UserWin: `{winner} won {amount} cash!\n\n{choice} \n{targetChoice}`,
}

module.exports = {
    cooldown: 5,
    category: 'Games',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play Rock Paper Scissors')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of cash to bet')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to challenge')
                .setRequired(false)
        ),
    /**
     * @param {CommandInteraction} interaction
    */

    async execute(interaction) {
        const { options, user, client } = interaction;

        const amount = options.getInteger('amount');
        const target = options.getUser('target');

        if(amount < 1) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.InvalidAmount);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        var userCurrency = await UserCurrency.findOne({ userId: user.id });

        if(!userCurrency) {
            userCurrency = await UserCurrency.create({ userId: user.id });
        }

        if(userCurrency.cash < amount) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.UserNotEnoughCash);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        if(!target) {
            
            const BotChoice = choices[Math.floor(Math.random() * choices.length)];

            const StartGameEmbed = new EmbedBuilder()
                .setColor('Blurple')
                .setDescription(messages.BotChallenge.replace('{amount}', amount));

            const Buttons = choices.map(choice => {
                return new ButtonBuilder()
                    .setCustomId(`Ovx_RockPaperScissors_${choice.name}`)
                    .setLabel(`${choice.name}`)
                    .setEmoji(choice.emoji)
                    .setStyle(ButtonStyle.Primary)
            });

            const row = new ActionRowBuilder().addComponents(Buttons);
            const reply = await interaction.reply({ content: `${user}`, embeds: [StartGameEmbed], components: [row] });

            const userInteraction = await reply.awaitMessageComponent({ filter: i => i.user.id === user.id, time: 60_000 }).catch(() => {
                const Embed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription(messages.GameOver.replace('{user}', user.username));
                return reply.edit({ embeds: [Embed], components: [] });
            });

            if(!userInteraction) return;

            const userChoice = choices.find(choice => userInteraction.customId === `Ovx_RockPaperScissors_${choice.name}`);

            const PickedEmbed = new EmbedBuilder()
                .setColor('Blurple')
                .setDescription(`You picked ${userChoice.name} ${userChoice.emoji}`);

            userInteraction.reply({ embeds: [PickedEmbed], ephemeral: true });

            setTimeout(() => {
                userInteraction.deleteReply();
            }, 5000);

            const botChoice = choices[Math.floor(Math.random() * choices.length)];

            let result;

            if(botChoice.beats === userChoice.name) {
                result = `${client.user} won ${amount} cash!`;
                userCurrency.cash -= amount;
            } else if(userChoice.beats === botChoice.name) {
                result = `${user} won ${amount} cash!`;
                userCurrency.cash += amount;
            } else {
                result = 'Its a tie!';
            }

            await userCurrency.save();

            StartGameEmbed.setDescription(result);

            const FinishEmbed = new EmbedBuilder()
                .setColor('Blurple')
                .addFields(
                    { name: `${user.username}`, value: `${userChoice.name} ${userChoice.emoji}`, inline: true },
                    { name: 'Bot', value: `${botChoice.name} ${botChoice.emoji}`, inline: true },
                    { name: 'Result', value: result, inline: true }
                );

            reply.edit({ content: '', embeds: [FinishEmbed], components: [] });

            return;

        }

        if(target.bot) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.UserNoBot);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        if(target.id === user.id) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.UserNoSelf);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        var targetCurrency = await UserCurrency.findOne({ userId: target.id });

        if(!targetCurrency) {
            targetCurrency = await UserCurrency.create({ userId: target.id });
        }

        if(targetCurrency.cash < amount) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.TargetNotEnoughCash);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        const StartGameEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(messages.UserChallenge.replace('{user}', user.username).replace('{target}', target.username).replace('{amount}', amount));

        const Buttons = choices.map(choice => {
            return new ButtonBuilder()
                .setCustomId(`Ovx_RockPaperScissors_${choice.name}`)
                .setLabel(`${choice.name}`)
                .setEmoji(choice.emoji)
                .setStyle(ButtonStyle.Primary)
        });

        const row = new ActionRowBuilder().addComponents(Buttons);
        const reply = await interaction.reply({ content: `${target}`, embeds: [StartGameEmbed], components: [row] });

        const targetInteraction = await reply.awaitMessageComponent({ filter: i => i.user.id === target.id, time: 60_000 }).catch(() => {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.GameOver.replace('{user}', target.username));
            return reply.editReply({ embeds: [Embed], components: [] });
        });

        if(!targetInteraction) return;

        const targetChoice = choices.find(choice => targetInteraction.customId === `Ovx_RockPaperScissors_${choice.name}`);

        const PickedEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(`You picked ${targetChoice.name} ${targetChoice.emoji}`);

        
        targetInteraction.reply({ embeds: [PickedEmbed], ephemeral: true });

        setTimeout(() => {
            targetInteraction.deleteReply();
        }, 5000);

        StartGameEmbed.setDescription(`Its ${user.username}'s turn to pick`);
        await reply.edit({ content: `${user}`, embeds: [StartGameEmbed] });

        const userInteraction = await reply.awaitMessageComponent({ filter: i => i.user.id === user.id, time: 60_000 }).catch(() => {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.GameOver.replace('{user}', user.username));
            return reply.edit({ embeds: [Embed], components: [] });
        });

        if(!userInteraction) return;

        const userChoice = choices.find(choice => userInteraction.customId === `Ovx_RockPaperScissors_${choice.name}`);

        let result

        if(targetChoice.beats === userChoice.name) {
            result = `${target} wins ${amount} cash!`;
            userCurrency.cash -= amount;
            targetCurrency.cash += amount;
        } else if(userChoice.beats === targetChoice.name) {
            result = `${user} wins ${amount} cash!`;
            userCurrency.cash += amount;
            targetCurrency.cash -= amount;
        } else {
            result = 'Its a tie!';
        }

        await userCurrency.save();
        await targetCurrency.save();


        StartGameEmbed.setDescription(result);

        const FinishEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .addFields(
                { name: `${user.username}`, value: `${userChoice.name} ${userChoice.emoji}`, inline: true },
                { name: `${target.username}`, value: `${targetChoice.name} ${targetChoice.emoji}`, inline: true },
                { name: 'Result', value: result, inline: true }
            );

        reply.edit({ content: '', embeds: [FinishEmbed], components: [] });
        

    }

};