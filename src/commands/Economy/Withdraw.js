const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType } = require('discord.js');
const { UserCurrency } = require('../../models/UserSetups');
module.exports = {
    cooldown: 5,
    category: 'Economy',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw money from your bank')
        .setContexts( InteractionContextType.Guild, InteractionContextType.PrivateChannel, InteractionContextType.BotDM )
        .addIntegerOption(option => option
            .setName('amount')
            .setDescription('The amount of money you want to withdraw')
            .setRequired(true)
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, user } = interaction;

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
                .setFooter({ text: `Cash: ${userCurrency.cash.toLocaleString()} | Bank: ${userCurrency.bank.toLocaleString()}` });
            return await interaction.reply({ embeds: [Embed] });
        }

        userCurrency.cash += amount;
        userCurrency.bank -= amount;

        await userCurrency.save();

        const WithdrawEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(`You have withdrawn \`${amount.toLocaleString()}\` into from bank`)
            .setFooter({ text: `Cash: ${userCurrency.cash.toLocaleString()} | Bank: ${userCurrency.bank.toLocaleString()}` });

        await interaction.reply({ embeds: [WithdrawEmbed] });
    
    }

};