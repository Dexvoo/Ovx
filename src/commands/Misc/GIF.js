const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType } = require('discord.js');
const { TenorAPIKey } = process.env;

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Search for a gif')
        .setContexts( InteractionContextType.Guild )
        .addStringOption(option => option
            .setName('query')
            .setDescription('The gif you want to search for')
            .setRequired(true)
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;
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
        const gifUrl = json.results[randomNumber].url;

        interaction.reply({ content: gifUrl });
        
    }


};