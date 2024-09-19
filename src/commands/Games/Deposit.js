const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType } = require('discord.js');
const { UserCurrency } = require('../../models/UserCurrency');
module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit money into your bank')
        .setContexts( InteractionContextType.Guild, InteractionContextType.PrivateChannel, InteractionContextType.BotDM )
        .addIntegerOption(option => option
            .setName('amount')
            .setDescription('The amount of money you want to deposit')
            .setRequired(true)
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;

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

        if(userCurrency.cash < amount) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('You do not have enough cash')
                .setFooter({ text: `Cash: ${userCurrency.cash.toLocaleString()} | Bank: ${userCurrency.bank.toLocaleString()}` });
            return await interaction.reply({ embeds: [Embed] });
        }

        userCurrency.cash -= amount;
        userCurrency.bank += amount;

        await userCurrency.save();

        const DepositEmbed = new EmbedBuilder()
            .setColor('Green')
            .setDescription(`You have deposited \`${amount.toLocaleString()}\` into your bank`)
            .setFooter({ text: `Cash: ${userCurrency.cash.toLocaleString()} | Bank: ${userCurrency.bank.toLocaleString()}` });

        await interaction.reply({ embeds: [DepositEmbed] });
    
    }

};