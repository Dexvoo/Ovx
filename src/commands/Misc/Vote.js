const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType } = require('discord.js');
const { PublicClientID } = process.env;

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Vote for the bot on top.gg')
        .setContexts( InteractionContextType.PrivateChannel, InteractionContextType.BotDM , InteractionContextType.Guild ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        
        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Vote')
            .setURL(`https://top.gg/bot/${PublicClientID}/vote`)
        );

        const Embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription('Click the button below to vote for the bot on top.gg')

        await interaction.reply({ embeds: [Embed], components: [button] });
    }
};