const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType, PermissionFlagsBits, ApplicationIntegrationType } = require('discord.js');
const { TenorAPIKey } = process.env;

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [PermissionFlagsBits.EmbedLinks],
    botpermissions: [PermissionFlagsBits.EmbedLinks],
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Search for a gif')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel )
        .addStringOption(option => option
            .setName('query')
            .setDescription('The gif you want to search for')
            .setRequired(true)
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options } = interaction;
        const query = options.getString('query');

        const params = `key=${TenorAPIKey}&q=${query}&limit=50&contentfilter=high&media_filter=minimal&ar_range=all`;
        const url = `https://tenor.googleapis.com/v2/search?` + params;
        const response = await fetch(url);

        if (!response.ok) {
            const RateLimitEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('The API returned an error. Please try again later.');
            return await interaction.reply({ embeds: [RateLimitEmbed], ephemeral: true });

        }

        const json = await response.json();
        const randomNumber = Math.floor(Math.random() * (50 - 0) + 0);

        if(json.results.length === 0) {
            const NoResultsEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('No results found for the given query.');
            return await interaction.reply({ embeds: [NoResultsEmbed], ephemeral: true });
        }
        
        const gifUrl = json.results[randomNumber].url;

        interaction.reply({ content: gifUrl });
        
    }


};