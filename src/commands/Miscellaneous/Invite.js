const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { DeveloperMode, PublicClientID, DevClientID } = process.env;

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Generate an invite link for the bot/support server')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { client } = interaction;
        const supportServer = 'https://discord.gg/uPGkcXyNZ3';
        var buttons

        if(DeveloperMode === 'true') {
            buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel('Support Server')
                    .setURL(supportServer),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel('Invite Bot')
                    .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
                    .setDisabled(DeveloperMode === 'true')
            )
        } else {
            buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('Support Server')
                .setURL(supportServer),
                new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('Invite Bot')
                .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
            )
        }

        const inviteEmbed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setDescription('Click the buttons below to join the support server or invite the bot to your server!')

        await interaction.reply({ embeds: [inviteEmbed], components: [buttons] });
        
    }

};