const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType } = require('discord.js');
const { UserCurrency } = require('../../models/UserCurrency');
module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('givecash')
        .setDescription('Give cash to another user')
        .setContexts( InteractionContextType.Guild, InteractionContextType.PrivateChannel, InteractionContextType.BotDM )
        .addUserOption(option => option
            .setName('user')
            .setDescription('The user you want to give cash to')
            .setRequired(true)
        )
        .addIntegerOption(option => option
            .setName('amount')
            .setDescription('The amount of money you want to deposit')
            .setRequired(true)
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, user, guild, channel } = interaction;

        var userCurrency = await UserCurrency.findOne({ userId: user.id });
        
        if(!userCurrency) {
            userCurrency = new UserCurrency({
                userId: user.id,
            });
            await userCurrency.save();
        }
        
        const amount = options.getInteger('amount');

        if(amount < 1) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('Please provide a valid amount')
                .setFooter({ text: `Cash: ${userCurrency.cash.toLocaleString()}` });
            return await interaction.reply({ embeds: [Embed] });
        }

        if(userCurrency.cash < amount) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('You do not have enough cash')
                .setFooter({ text: `Cash: ${userCurrency.cash.toLocaleString()}` });
            return await interaction.reply({ embeds: [Embed] });
        }

        const targetUser = options.getUser('user');


        var targetCurrency = await UserCurrency.findOne({ userId: targetUser.id });

        if(!targetCurrency) {
            targetCurrency = new UserCurrency({
                userId: targetUser.id,
            });
            await targetCurrency.save();
        }

        userCurrency.cash -= amount;
        targetCurrency.cash += amount;

        await userCurrency.save();
        await targetCurrency.save();

        const DepositEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(`You have given \`${amount.toLocaleString()}\` to @${targetUser.username}`)
            .setFooter({ text: `Cash: ${userCurrency.cash.toLocaleString()} | Bank: ${userCurrency.bank.toLocaleString()}` });

        await interaction.reply({ embeds: [DepositEmbed] });

    }

};