const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, AutocompleteInteraction, ApplicationIntegrationType, InteractionContextType, User } = require('discord.js');
// I'm assuming Cache_XP.getTopUsers returns a sorted list of all users with XP for a guild.
const Cache_XP = require('../../cache/XP'); 
const LevelCache = require('../../cache/Levels');
const { DeveloperIDs } = process.env;

module.exports = {
    cooldown: 0,
    category: 'Developer',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('devstats')
        .setDescription('Developer stats (devs only)')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts(InteractionContextType.Guild)
        .addSubcommandGroup(group => group
            .setName('guilds')
            .setDescription('Guild stats')
            .addSubcommand(subcommand => subcommand
                .setName('leaderboard')
                .setDescription('View the leaderboard for a specific guild.')
                .addStringOption(option => option
                    .setName('guild')
                    .setDescription('The guild to view the leaderboard for.')
                    .setAutocomplete(true)
                    .setRequired(true)
                )
                .addStringOption(option => option
                    .setName('type')
                    .setDescription('The type of leaderboard to show.')
                    .setRequired(true)
                    .addChoices(
                        // FIX: Changed the value from 'levels' to 'level' to match the typeConfig key.
                        { name: 'Levels', value: 'level' }, 
                        { name: 'Messages', value: 'messages' },
                        { name: 'Voice', value: 'voice' }
                    )
                )
            )
            .addSubcommand(subcommand => subcommand
                .setName('topservers')
                .setDescription('Shows the top servers the bot is in by member count.')
            )
        ),

    /**
     * @param {AutocompleteInteraction} interaction
     */
    async autocomplete(interaction) {
        if (!interaction.client.shard) {
            const guilds = interaction.client.guilds.cache;
            const choices = guilds.map(guild => ({ name: `${guild.name} | ${guild.id}`, value: guild.id }));
            const value = interaction.options.getFocused().toLowerCase();
            const filteredChoices = choices.filter(choice => choice.name.toLowerCase().includes(value)).slice(0, 25);
            return await interaction.respond(filteredChoices);
        }

        const focusedValue = interaction.options.getFocused().toLowerCase();
        if (focusedValue === '') return await interaction.respond([]);

        const allGuilds = (await interaction.client.shard.broadcastEval(c => c.guilds.cache.map(g => ({ name: g.name, id: g.id })))).flat();
        const filtered = allGuilds.filter(guild =>
            guild.name.toLowerCase().includes(focusedValue) || guild.id.includes(focusedValue)
        ).slice(0, 25);

        await interaction.respond(
            filtered.map(guild => ({ name: `${guild.name} | ${guild.id}`, value: guild.id }))
        );
    },

    /**
    * @param {import('../../types').CommandInputUtils} interaction
    */
    async execute(interaction) {
        if (!DeveloperIDs.includes(interaction.user.id)) {
            const embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('You must be a developer to use this command.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        // Deferring here handles all subcommands
        await interaction.deferReply({});

        if (group === 'guilds') {
            if (subcommand === 'leaderboard') {
                await guildLeaderboard(interaction);
            } else if (subcommand === 'topservers') {
                await topServers(interaction);
            }
        }
    }
};

/**
 * @param {CommandInteraction} interaction
 */
async function guildLeaderboard(interaction) {
    const { client, options, user } = interaction;
    const guildId = options.getString('guild');
    const type = options.getString('type');

    console.log(`DevStats: Fetching leaderboard for guild ${guildId} with type ${type} by user ${user.tag}`);

    let fetchedGuild;
    try {
        fetchedGuild = await client.guilds.fetch(guildId);
    } catch (error) {
        console.error(`Failed to fetch guild ${guildId} for devstats:`, error);
        const embed = new EmbedBuilder().setColor(Colors.Red).setDescription('Could not find or fetch the specified guild.');
        return interaction.editReply({ embeds: [embed] });
    }

    // This is good practice!
    const LevelConfigData = await LevelCache.get(guildId);
    if (!LevelConfigData || !LevelConfigData.enabled) {
        const embed = new EmbedBuilder().setColor(Colors.Red).setTitle('Levels Disabled').setDescription(`Leveling is not enabled in \`${fetchedGuild.name}\`.`);
        return interaction.editReply({ embeds: [embed] });
    }
    
    const typeConfig = {
        level: {
            sortField: 'level',
            format: (u, data) => {
                const rank = `\`${data.rank}.\``.padEnd(4);
                const name = `\`@${u.username.substring(0, 15).padEnd(15)}\``;
                const level = `${client.CustomEmojis.levelling.Level} \`${data.level.toString().padEnd(3)}\``;
                const xp = `${client.CustomEmojis.levelling.XP} \`${data.xp.toLocaleString().padEnd(6)}\``;
                const messages = `⌨️ \`${data.totalMessages.toLocaleString().padEnd(6)}\``;
                const voice = `🎙️ \`${(data.totalVoice / 60).toFixed(1).padEnd(5)}h\``;
                return `${rank} ${name} | ${level} ${xp} | ${messages} ${voice}`;
            }
        },
        messages: {
            sortField: 'totalMessages',
            format: (u, data) => `\`${data.rank}.\` \`@${u.username.substring(0, 15).padEnd(15)}\` | M: \`${data.totalMessages.toLocaleString()}\``
        },
        voice: {
            sortField: 'totalVoice',
            format: (u, data) => `\`${data.rank}.\` \`@${u.username.substring(0, 15).padEnd(15)}\` | V: \`${(data.totalVoice / 60).toFixed(1)}h\``
        },
    };

    const config = typeConfig[type];
    if (!config) {
        const embed = new EmbedBuilder().setColor(Colors.Red).setDescription('Invalid leaderboard type specified.');
        return interaction.editReply({ embeds: [embed] });
    }
    
    const allLeaderboardData = await Cache_XP.getTopUsers(fetchedGuild.id, config.sortField, client);
    if (!allLeaderboardData || allLeaderboardData.length === 0) {
        const embed = new EmbedBuilder().setColor(Colors.Orange).setDescription('No one in this guild has earned XP yet.');
        return interaction.editReply({ embeds: [embed] });
    }
    
    // FIX: Removed the redundant .sort() call. Cache_XP.getTopUsers should handle sorting.

    // Calculate totals from the entire dataset returned from the cache
    const totals = allLeaderboardData.reduce((acc, curr) => {
        acc.levels += curr.level;
        acc.messages += curr.totalMessages;
        acc.voice += curr.totalVoice;
        return acc;
    }, { levels: 0, messages: 0, voice: 0 });

    // Now, slice the top 15 users for display
    const topUsersToDisplay = allLeaderboardData.slice(0, 15);

    const userPromises = topUsersToDisplay.map(async (userData, i) => {
        try {
            const fetchedUser = await client.users.fetch(userData.userId);
            const rankedData = { ...userData, rank: `${i + 1}`.padStart(2, ' ') };
            return config.format(fetchedUser, rankedData);
        } catch {
            // If a user can't be fetched (e.g., they left Discord), just return null.
            return null;
        }
    });

    const settledResults = await Promise.allSettled(userPromises);
    const leaderboardLines = settledResults
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);

    if (leaderboardLines.length === 0) {
        const embed = new EmbedBuilder().setColor(Colors.Orange).setDescription('Could not display any users. They may have left the platform.');
        return interaction.editReply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
        .setTitle(`${fetchedGuild.name} | ${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard`)
        // .setThumbnail(fetchedGuild.iconURL())
        .setColor(Colors.Blurple)
        .setDescription(leaderboardLines.join('\n'))
        .addFields(
            { name: 'Total Guild Levels', value: totals.levels.toLocaleString(), inline: true },
            { name: 'Total Guild Messages', value: totals.messages.toLocaleString(), inline: true },
            { name: 'Total Guild Voice', value: `${(totals.voice / 60).toFixed(1)} hours`, inline: true }
        )
        .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL() })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}


/**
 * @param {CommandInteraction} interaction
*/
async function topServers(interaction) {
    const { client, user } = interaction;

    if (!client.shard) {
        const guilds = [...client.guilds.cache.values()]
            .map(g => ({ name: g.name, id: g.id, memberCount: g.memberCount }))
            .sort((a, b) => b.memberCount - a.memberCount)
            .slice(0, 10);
        
        const embed = new EmbedBuilder()
            .setTitle(`Top 10 Servers (Non-Sharded)`)
            .setDescription(guilds.map((g, i) => `**${i + 1}.** ${g.name} (\`${g.id}\`) - ${g.memberCount.toLocaleString()} members`).join('\n'))
            .setColor(Colors.Blurple)
            .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL() });
        return await interaction.editReply({ embeds: [embed] });
    }

    const results = await client.shard.broadcastEval(c => c.guilds.cache.map(g => ({ name: g.name, id: g.id, memberCount: g.memberCount })));
    const allGuilds = results.flat();
    const sortedGuilds = allGuilds.sort((a, b) => b.memberCount - a.memberCount).slice(0, 10);

    const totalGuildsArr = await client.shard.fetchClientValues('guilds.cache.size');
    const totalGuilds = totalGuildsArr.reduce((sum, count) => sum + count, 0);
    const totalMembersArr = await client.shard.broadcastEval(c => c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0));
    const totalMembers = totalMembersArr.reduce((sum, count) => sum + count, 0);

    const embed = new EmbedBuilder()
        .setTitle(`Top 10 Servers`)
        .setDescription(`Across **${totalGuilds.toLocaleString()}** servers with a total of **${totalMembers.toLocaleString()}** users.`)
        .setColor(Colors.Blurple)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
            { name: 'Server', value: sortedGuilds.map(g => `-# ${g.name.substring(0, 25)}`).join('\n'), inline: true },
            { name: 'Members', value: sortedGuilds.map(g => `-# ${g.memberCount.toLocaleString()}`).join('\n'), inline: true },
            { name: 'Server ID', value: sortedGuilds.map(g => `-# ${g.id}`).join('\n'), inline: true }
        )
        .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL() })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}