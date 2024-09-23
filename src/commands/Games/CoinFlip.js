const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, User, ApplicationIntegrationType } = require('discord.js');
const { UserCurrency } = require('../../models/UserCurrency');

const choices = [
    { name: 'Heads', beats: 'Tails', emoji: '<:OVX_Tails:1286316509525704766>' },
    { name: 'Tails', beats: 'Heads', emoji: '<:OVX_Heads:1286316499446796400>' },
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
    UserChallenge: `{user} has challenged {target} to a coinflip for {amount} cash!`,
    UserWin: `{winner} won {amount} cash!\n\n{choice} \n{targetChoice}`,
}

module.exports = {
    cooldown: 5,
    category: 'Games',
    userpermissions: [],
    botpermissions: [PermissionFlagsBits.UseExternalEmojis],
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel )
        .addIntegerOption(option => option
            .setName('amount')
            .setDescription('The amount of cash you want to bet')
            .setRequired(true)
        )
        .addUserOption(option => option
            .setName('user')
            .setDescription('The user you want to bet against')
            .setRequired(false)
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, user } = interaction;

        
        const amount = options.getInteger('amount');
        const targetUser = options.getUser('user');

        // no max bet
        var userCurrency = await UserCurrency.findOne({ userId: user.id });

        if(!userCurrency) {
            userCurrency = new UserCurrency({
                userId: user.id,
            });
            await userCurrency.save();
        }

        if(amount < 1) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.InvalidAmount);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        if(userCurrency.cash < amount) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.UserNotEnoughCash);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        if(!targetUser) {
            // bet against the bot
            const StartGameEmbed = new EmbedBuilder()
                .setColor('Blurple')
                .setDescription(messages.BotChallenge.replace('{amount}', amount.toLocaleString()));

            const Buttons = choices.map(choice => {
                return new ButtonBuilder()
                    .setCustomId(`Ovx_Coinflip_${choice.name}`)
                    .setLabel(`${choice.name}`)
                    .setEmoji(choice.emoji)
                    .setStyle(ButtonStyle.Primary)
            });

            const row = new ActionRowBuilder().addComponents(Buttons);

            const reply = await interaction.reply({ embeds: [StartGameEmbed], components: [row] });

            const userInteraction = await reply.awaitMessageComponent({ filter: i => i.user.id === user.id, time: 60_000 }).catch(async () => {
                const Embed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription(messages.GameOver.replace('{user}', user.username));
                    await reply.edit({ embeds: [Embed], components: [] }).catch(() => {});
                return
            })
    
            if(!userInteraction) return;

            const userChoice = choices.find(choice => userInteraction.customId === `Ovx_Coinflip_${choice.name}`);
            const botChoice = choices.find(choice => userChoice.beats === choice.name);

            const randomNumber = Math.floor(Math.random() * (2 - 0) + 0);
            const sides = ['Heads', 'Tails'];

            if(sides[randomNumber] === userChoice.name) {
                    
                    userCurrency.cash += amount;
                    await userCurrency.save();
    
                    const Embed = new EmbedBuilder()
                        .setColor('Blurple')
                        .setDescription(messages.BotLose.replace('{amount}', amount.toLocaleString()).replace('{choice}', `${userChoice.name} ${userChoice.emoji}`).replace('{botChoice}',  `${botChoice.name} ${botChoice.emoji}`));
                    await reply.edit({ embeds: [Embed], components: [] }).catch(() => {});
                } else {
                    
                    userCurrency.cash -= amount;
                    await userCurrency.save();
        
                    const Embed = new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(messages.BotWin.replace('{amount}', amount.toLocaleString()).replace('{choice}', `${userChoice.name} ${userChoice.emoji}`).replace('{botChoice}',  `${botChoice.name} ${botChoice.emoji}`));
                    await reply.edit({ embeds: [Embed], components: [] }).catch(() => {});
                }

            return;
        }

        if(targetUser.bot) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.UserNoBot);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });   
        }

        if(targetUser.id === user.id) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.UserNoSelf);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        var targetCurrency = await UserCurrency.findOne({ userId: targetUser.id });

        if(!targetCurrency) {
            targetCurrency = new UserCurrency({
                userId: targetUser.id,
            });
            await targetCurrency.save();
        }

        if(amount > targetCurrency.cash) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.TargetNotEnoughCash);
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        const StartGameEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(messages.UserChallenge.replace('{user}', user.username).replace('{target}', targetUser.username).replace('{amount}', amount.toLocaleString()));

        
        const Buttons = choices.map(choice => {
            return new ButtonBuilder()
                .setCustomId(`Ovx_Coinflip_${choice.name}`)
                .setLabel(`${choice.name}`)
                .setEmoji(choice.emoji)
                .setStyle(ButtonStyle.Primary)
        });

        const row = new ActionRowBuilder().addComponents(Buttons);

        const reply = await interaction.reply({ content: `${targetUser}`, embeds: [StartGameEmbed], components: [row] });

        const targetUserInteraction = await reply.awaitMessageComponent({ filter: i => i.user.id === targetUser.id, time: 60_000 }).catch(async () => {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(messages.GameOver.replace('{user}', targetUser));
                await reply.edit({ embeds: [Embed], components: [] }).catch(() => {});
            return
        })

        if(!targetUserInteraction) return;

        const targetUserChoice = choices.find(choice => targetUserInteraction.customId === `Ovx_Coinflip_${choice.name}`);
        const userChoice = choices.find(choice => targetUserChoice.beats === choice.name);
        
        const randomNumber = Math.floor(Math.random() * (2 - 0) + 0);
        const sides = ['Heads', 'Tails'];

        const FinishEmbed = new EmbedBuilder()
            .setColor('Blurple');

        if(sides[randomNumber] === userChoice.name) {
                
            userCurrency.cash += amount;
            targetCurrency.cash -= amount;
            await userCurrency.save();
            await targetCurrency.save();

            FinishEmbed.setDescription(messages.UserWin.replace('{winner}', `@${user.username}`).replace('{amount}', amount.toLocaleString()).replace('{choice}', `@${user.username} : ${userChoice.name} ${userChoice.emoji}`).replace('{targetChoice}',  `@${targetUser.username} : ${targetUserChoice.name} ${targetUserChoice.emoji}`));
        } else {

            userCurrency.cash -= amount;
            targetCurrency.cash += amount;
            await userCurrency.save();
            await targetCurrency.save();

            FinishEmbed.setDescription(messages.UserWin.replace('{winner}', `@${targetUser.username}`).replace('{amount}', amount.toLocaleString()).replace('{choice}', `@${user.username} : ${userChoice.name} ${userChoice.emoji}`).replace('{targetChoice}',  `@${targetUser.username} : ${targetUserChoice.name} ${targetUserChoice.emoji}`));
        }
        
        await reply.edit({ content: '', embeds: [FinishEmbed], components: [] }).catch(() => {});

    }

};