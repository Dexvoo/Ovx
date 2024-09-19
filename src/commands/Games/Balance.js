const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType } = require('discord.js');
const { UserCurrency } = require('../../models/UserCurrency');

module.exports = {
    cooldown: 5,
    category: 'Economy',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check how much cash and money in the bank you have')
        .setContexts( InteractionContextType.Guild, InteractionContextType.PrivateChannel, InteractionContextType.BotDM ),

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
        
        const BalanceEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setTitle(`@${user.username}'s balance`)
            .setDescription(
                [ `Cash : \`${userCurrency.cash.toLocaleString()}\``, `Bank : \`${userCurrency.bank.toLocaleString()}\`` ].join('\n')
            )

        await interaction.reply({ embeds: [BalanceEmbed] });
    }

};