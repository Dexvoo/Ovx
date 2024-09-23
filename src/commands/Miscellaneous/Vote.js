const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { PublicClientID } = process.env;

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Vote for the bot on top.gg')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel ),

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