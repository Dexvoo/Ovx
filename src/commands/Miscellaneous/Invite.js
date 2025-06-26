const { SlashCommandBuilder, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
require('dotenv').config();
const { DeveloperMode, SupportServerUrl } = process.env;

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Provides the invite link to the support server and installs')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel ),

    /**
     * @param {import('../../types').CommandInputUtils} interaction
     */

    async execute(interaction) {
        const { client } = interaction;
        
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('Support Server')
                .setURL(SupportServerUrl),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('Guild/User Installs')
                .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}`)
                .setDisabled(DeveloperMode === 'true')
        );

        const inviteEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription('Need help? Join our support server! User installs and Guild installs are available.');

        await interaction.reply({ embeds: [inviteEmbed], components: [buttons] });
    }
};