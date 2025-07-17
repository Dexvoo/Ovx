const { SlashCommandBuilder, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
require('dotenv').config();
const { DeveloperMode, SupportServerUrl, PublicClientID } = process.env;

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Provides the link to the top.gg page to vote for the bot')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel ),

    /**
     * @param {import('../../types').CommandInputUtils} interaction
     */

    async execute(interaction) {
        
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('Vote ❤️')
                .setURL(`https://top.gg/bot/${PublicClientID}/vote`)
        );

        const inviteEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription('**Rewards**: \n10% Extra XP Gain\n\nClick the button below to vote for the bot and support its development!');

        await interaction.reply({ embeds: [inviteEmbed], components: [buttons] });
    }
};