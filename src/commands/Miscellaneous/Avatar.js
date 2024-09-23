const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType, ActionRowBuilder, ButtonStyle, ButtonBuilder, ApplicationIntegrationType } = require('discord.js');

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Get the avatar of a user/guild')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel )
        .addSubcommandGroup((group) => group
            .setName('discord')
            .setDescription('Get the avatar of a user/guild.')
            .addSubcommand((subcommand) => subcommand
                .setName('user')
                .setDescription('Get the avatar of a user.')
                .addUserOption((option) => option
                    .setName('user')
                    .setDescription('The user you would like to get the avatar of.')
                    .setRequired(false)
                )
            )
            .addSubcommand((subcommand) => subcommand
                .setName('guild')
                .setDescription('Get the avatar of a guild.')
            )
        ),

    /**
     * @param {CommandInteraction} interaction
     */
    async execute(interaction) {
        const { options } = interaction;
        const subcommandGroup = options.getSubcommandGroup();
        const subcommand = options.getSubcommand();

        if (subcommandGroup === 'discord') {
            if (subcommand === 'user') {
                return await discordAvatarUser(interaction);
            } else if (subcommand === 'guild') {
                return await discordAvatarGuild(interaction);
            }
        }
    }
};

/**
 * Fetches and sends the avatar of a user.
 * @param {CommandInteraction} interaction
 * @returns {Promise<void>}
 */
async function discordAvatarUser(interaction) {
    const { options, user } = interaction;
    const userOption = options.getUser('user') || user; // Use the mentioned user or the author if none provided

    try {
        // Get avatar URL with dynamic support
        const avatarUrl = userOption.displayAvatarURL({ dynamic: true, size: 4096 });

        const LinkButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('PNG')
                .setURL(userOption.displayAvatarURL({ format: 'png', size: 1024})),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('JPG')
                .setURL(userOption.displayAvatarURL({ format: 'jpeg', size: 1024 })),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('GIF')
                .setURL(userOption.displayAvatarURL({ dynamic: true, size: 1024 })),
        )

        const DiscordEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setAuthor({ name: `@${userOption.username}'s Avatar`, iconURL: avatarUrl })
            .setImage(avatarUrl);

        return await interaction.reply({ embeds: [DiscordEmbed], components: [LinkButton] });
    } catch (error) {
        console.error(error);

        const errorEmbed = new EmbedBuilder()
            .setColor('Red')
            .setDescription('An error occurred while fetching the user\'s avatar.');

        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

/**
 * Fetches and sends the avatar of the guild.
 * @param {CommandInteraction} interaction
 * @returns {Promise<void>}
 */
async function discordAvatarGuild(interaction) {
    const { guild } = interaction;

    if (guild?.iconURL()) {
        const guildAvatarUrl = guild.iconURL({ dynamic: true, size: 4096 });

        const DiscordEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setAuthor({ name: `${guild.name}'s Avatar`, iconURL: guildAvatarUrl })
            .setImage(guildAvatarUrl);

        return await interaction.reply({ embeds: [DiscordEmbed] });
    } else {
        const noAvatarEmbed = new EmbedBuilder()
            .setColor('Red')
            .setDescription('This guild does not have an avatar.');

        return await interaction.reply({ embeds: [noAvatarEmbed] });
    }
}
