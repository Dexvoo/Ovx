const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription('Get the banner of a user/guild')
        .setContexts( InteractionContextType.Guild )
        .addSubcommandGroup((group) => group
            .setName('discord')
            .setDescription('Get the banner of a user/guild.')
            .addSubcommand((subcommand) => subcommand
                .setName('user')
                .setDescription('Get the banner of a user.')
                .addUserOption((option) => option
                    .setName('user')
                    .setDescription('The user you would like to get the banner of.')
                    .setRequired(false)
                )
            )
            .addSubcommand((subcommand) => subcommand
                .setName('guild')
                .setDescription('Get the banner of a guild.')
            )
            
        )
        ,

        /**
         * @param {CommandInteraction} interaction
         */

        async execute(interaction) {
            const { options, client, member, guild, user, channel } = interaction;
            const subcommandGroup = options.getSubcommandGroup();
            const subcommand = options.getSubcommand();

            if(subcommandGroup === 'discord') {
                if(subcommand === 'user') {
                    return await discordBannerUser(interaction);
                } else if(subcommand === 'guild') {
                    return await discordBannerGuild(interaction);
                }
            }

            
        }
};




/**
 * @param {CommandInteraction} interaction
 * @returns {Promise<void>}
    */
async function discordBannerUser(interaction) {
    const { options, user } = interaction;
    const userOption = options.getUser('user') || user; // Use the mentioned user or the author if none provided

    try {
        // Fetch the user with the full data (forcing the banner to be included)
        const fetchedUser = await userOption.fetch({ force: true });

        if (fetchedUser.banner) {
            // Get the banner URL with dynamic sizing
            const bannerUrl = fetchedUser.bannerURL({ dynamic: false, size: 4096 });

            const DiscordEmbed = new EmbedBuilder()
                .setColor('Blurple')
                .setAuthor({ name: `@${fetchedUser.username}'s Banner`, iconURL: fetchedUser.displayAvatarURL({ dynamic: true, size: 4096 }) })
                .setImage(bannerUrl);
            
            return await interaction.reply({ embeds: [DiscordEmbed] });
        } else {
            const noBannerEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('This user does not have a banner.');

            return await interaction.reply({ embeds: [noBannerEmbed] });
        }
    } catch (error) {
        console.error(error);

        const errorEmbed = new EmbedBuilder()
            .setColor('Red')
            .setDescription('An error occurred while fetching the user\'s banner.');

        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

/**
 * @param {CommandInteraction} interaction
 * @returns {Promise<void>}
    */
async function discordBannerGuild(interaction) {
    const { guild } = interaction;

    if (guild?.banner) {
        const bannerUrl = guild.bannerURL({ dynamic: false, size: 4096 });

        const DiscordEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setAuthor({ name: `${guild.name}'s Banner`, iconURL: guild.iconURL({ dynamic: true, size: 4096 }) })
            .setImage(bannerUrl);
        
        return await interaction.reply({ embeds: [DiscordEmbed] });
    } else {
        const noBannerEmbed = new EmbedBuilder()
            .setColor('Red')
            .setDescription('This guild does not have a banner.');

        return await interaction.reply({ embeds: [noBannerEmbed] });
    }
}