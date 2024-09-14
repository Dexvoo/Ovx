const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, PermissionFlagsBits, parseEmoji, InteractionContextType, AutocompleteInteraction } = require('discord.js');
const { fetchLeaderboardData, sortLeaderboard } = require('../../utils/Levels/XP-Functions');
const { DeveloperIDs } = process.env;

module.exports = {
    cooldown: 0,
    category: 'Developer',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('devstats')
        .setDescription('Developer stats (devs only)')
        .setContexts( InteractionContextType.Guild )
        .addSubcommandGroup(group => group
            .setName('guilds')
            .setDescription('Guild stats')
            .addSubcommand(subcommand => subcommand
                .setName('leaderboard')
                .setDescription('Guild leaderboard')
                .addStringOption(option => option
                    .setName('guild')
                    .setDescription('Guild')
                    .setAutocomplete(true)
                    .setRequired(true)
                )
                .addStringOption((option) => option
			        .setName('type')
			        .setDescription('The type of leaderboard to show')
			        .setRequired(true)
			        .addChoices(
                        { name: 'Levels', value: 'levels' },
			        	{ name: 'Messages', value: 'messages' },
			        	{ name: 'Voice', value: 'voice' }
			        )
			    )
            )
            .addSubcommand(subcommand => subcommand
                .setName('topservers')
                .setDescription('Top servers')
            )
            
        ),

        /**
     * @param {AutocompleteInteraction} interaction
     */
    async autocomplete(interaction) {
        const { options, client } = interaction;
        const value = options.getFocused();
        const guilds = interaction.client.guilds.cache;

        const choices = guilds.map(guild => ({ name: `${guild.name} | ${guild.id}`, value: guild.id }));
        const filteredChoices = choices.filter(choice => choice.name.toLowerCase().includes(value)).slice(0, 25);

        if (!interaction) return;

        await interaction.respond(filteredChoices);
    },

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, user } = interaction;
        
        if (!DeveloperIDs.includes(user.id)) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('You must be a developer to use this command');
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        const group = options.getSubcommandGroup();
        const subcommand = options.getSubcommand();

        if(group === 'guilds') {
            
            if(subcommand === 'leaderboard') {
                await guildLeaderboard(interaction);
            } else if(subcommand === 'topservers') {
                await topServers(interaction);
            }
        }
        
    }

};


/**
 * @param {CommandInteraction} interaction
*/

async function guildLeaderboard(interaction) {
    const { options, client, user } = interaction;
    const guildId = options.getString('guild');
    const type = options.getString('type');

    if(!guildId) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a guild ID');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    if(!type) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Please provide a type');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    const fetchedGuild = client.guilds.cache.get(guildId)

    if(!fetchedGuild) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('Guild not found');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    let leaderboardData = await fetchLeaderboardData(fetchedGuild.id, type);
    let totalGuildLevels = 0, totalGuildMessages = 0, totalGuildVoice = 0;

    for(const data of leaderboardData) {
        totalGuildLevels += data.level;
        totalGuildMessages += data.totalMessages;
        totalGuildVoice += data.totalVoice
    }

    if(!leaderboardData.length) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription('0 users have earned xp in this guild, please send messages to earn xp');
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    leaderboardData = leaderboardData.slice(0, 15);

    const sortedLeaderboard = await sortLeaderboard(client, leaderboardData);

    switch (type) {
        case 'levels':
            lb = sortedLeaderboard.map(
                (e) =>
                    `\`` +
                        `${e.position}`.padStart(2, ' ') +
                        `\`. \`@` +
                        `${e.username}`.padEnd(18, ' ') +
                        `\` | L: \`${
                            e.level
                        }\` | XP: \`${e.xp.toLocaleString()}\` | M: \`${e.totalMessages.toLocaleString()}\` | V: \`${e.totalVoice.toLocaleString()}\``
            )
            break;
        case 'voice':
            lb = sortedLeaderboard.map(
                (e) =>
                    `\`` +
                        `${e.position}`.padStart(2, ' ') +
                        `\`. \`@` +
                        `${e.username}`.padEnd(18, ' ') +
                        `\` | V: \`${
                            e.totalVoice.toLocaleString()
                        }\``
            )
            break;
        case 'messages':
            lb = sortedLeaderboard.map(
                (e) =>
                    `\`` +
                        `${e.position}`.padStart(2, ' ') +
                        `\`. \`@` +
                        `${e.username}`.padEnd(18, ' ') +
                        `\` | M: \`${
                            e.totalMessages.toLocaleString()
                        }\``
            )
            break;
        default:
            const InvalidTypeEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('Invalid leaderboard type');
            return await interaction.reply({ embeds: [InvalidTypeEmbed] });
    }


    const LeaderboardEmbed = new EmbedBuilder()
        .setTitle(`${fetchedGuild.name} | ${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard`)
        .setThumbnail(fetchedGuild.iconURL())
        .addFields(
            {
                name: 'Guild Levels',
                value: totalGuildLevels.toLocaleString(),
                inline: true,
            },
            {
                name: 'Guild Voice Time',
                value: totalGuildVoice.toLocaleString(),
                inline: true,
            },
            {
                name: 'Guild Messages',
                value: totalGuildMessages.toLocaleString(),
                inline: true,
            }
        )
        .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

    const pageSize = 5;
    const maxPages = 3;
    let currentPage = 1; // Initialize the current page to 1

    for (let i = 0; i < lb.length && currentPage <= maxPages; i += pageSize) {
        const page = lb.slice(i, i + pageSize);
        const name = `Top ${i + 1}-${Math.min(i + pageSize, lb.length)}`;
        const value = page.join('\n');
        LeaderboardEmbed.addFields({ name, value, inline: false });

        currentPage++; // Increment the current page number
    }
    await interaction.reply({ embeds: [LeaderboardEmbed] });
}

/**
 * @param {CommandInteraction} interaction
*/

async function topServers(interaction) {
    const { client, user } = interaction;
    const guilds = client.guilds.cache;
    const guildArray = guilds.map(guild => {
        return {
            name: guild.name,
            id: guild.id,
            memberCount: guild.memberCount
        }
    });

    const sortedGuilds = guildArray.sort((a, b) => b.memberCount - a.memberCount).slice(0, 10);

    // add all users up
    let totalUsers = 0;
    for(const guild of sortedGuilds) {
        totalUsers += guild.memberCount;
    }

    const TopServersEmbed = new EmbedBuilder()
        .setTitle(`Top 10 Servers | ${client.guilds.cache.size.toLocaleString()} Servers | ${totalUsers.toLocaleString()} Users`)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
            {
                name: 'Name',
                value: sortedGuilds.map(guild => guild.name).join('\n'),
                inline: true
            },
            {
                name: 'ID',
                value: sortedGuilds.map(guild => guild.id).join('\n'),
                inline: true
            },
            {
                name: 'Members',
                value: sortedGuilds.map(guild => guild.memberCount).join('\n'),
                inline: true
            }
        )
        .setFooter({ text: `Requested by ${user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

    await interaction.reply({ embeds: [TopServersEmbed] });
}