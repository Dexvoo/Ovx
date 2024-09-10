const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType, PermissionsBitField, PermissionFlagsBits } = require('discord.js');
const { UserLevels } = require('../../models/Levels');
const { LevelNotifications } = require('../../models/GuildSetups')
const { fetchLeaderboardData, sortLeaderboard } = require('../../utils/Levels/XP-Functions');
const { permissionCheck } = require('../../utils/Checks');
const { ExpForLevel } = require('../../utils/Levels/XPMathematics');

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Get a users level and XP or even a leaderboard')
        .setContexts( InteractionContextType.Guild )
        .addSubcommand(subcommand => subcommand
            .setName('rank')
            .setDescription('Shows your current level and XP in the guild')
            .addUserOption(option => option
                .setName('user')
                .setDescription('The user you want to check')
                .setRequired(false)
            )
        )
        .addSubcommand((subcommand) => subcommand
			.setName('leaderboard')
			.setDescription('Displays the most active users in a leaderboard')

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
            .setName('admin')
            .setDescription('Admin commands for levels')
            .addStringOption((option) => option
                .setName('type')
                .setDescription('The type of change to make')
                .setRequired(true)
                .addChoices(
                    { name: 'Level', value: 'level' },
			    	{ name: 'XP', value: 'xp' },
			    	{ name: 'Reset', value: 'reset' },
			    )
            )
            .addIntegerOption((option) => option
                .setName('amount')
                .setDescription('The amount to change to')
                .setRequired(true)
            )
            .addUserOption((option) => option
                .setName('user')
                .setDescription('The user to change')
                .setRequired(true)
            )
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, channel } = interaction;
        
        const subcommand = options.getSubcommand();

        const levelNotifications = await LevelNotifications.findOne({ guildId: guild.id });

        if (!levelNotifications) {
            const NoLevelNotificationsEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('Levels have not been enabled in this guild | To enable them a server admin can use `/setup guild levels`');
            return await interaction.reply({ embeds: [NoLevelNotificationsEmbed] });
        }

        if(!levelNotifications.enabled) {
            const LevelNotificationsDisabledEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('Levels are disabled in this guild | To enable them a server admin can use `/setup guild levels`');
            return await interaction.reply({ embeds: [LevelNotificationsDisabledEmbed] });
        }

        switch (subcommand) {
            case 'rank': 
                await handleRankCommand(interaction)
                break;
            case 'leaderboard':
                await handleLeaderboardCommand(interaction)
                break;
            case 'admin':
                await handleAdminCommand(interaction)
                break;
            default:
                const InvalidSubcommandEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('Invalid subcommand');
                await interaction.reply({ embeds: [InvalidSubcommandEmbed] });
                break;
        }
    }

};


/**
* @param {CommandInteraction} interaction
*/
async function handleRankCommand(interaction) {
    const { options, member, guild, client } = interaction;

    const rankUser = options.getUser('user') || member.user;


    const userData = await UserLevels.findOne({ guildId: guild.id, userId: rankUser.id});
    if (!userData) {
        return await interaction.reply({ content: 'User has no data', ephemeral: true });
    }
    
    const rankEmbed = new EmbedBuilder()
        .setColor('Blurple')
        .setTitle(`@${rankUser.username}'s Rank`)
        .setThumbnail(rankUser.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Level', value: `**${userData.level}**`, inline: true },
            { name: 'XP', value: `**${userData.xp}**`, inline: true },
            { name: 'Messages', value: `**${userData.totalMessages}**`, inline: true },
            { name: 'Voice Time', value: `**${userData.totalVoice}** minutes`, inline: true }
        )
        .setFooter({ text: `Requested by ${member.user.username}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp()
        .setImage('https://i.sstatic.net/Fzh0w.png');

    await interaction.reply({ embeds: [rankEmbed] });
}

/**
* @param {CommandInteraction} interaction
*/
async function handleLeaderboardCommand(interaction) {
    const { options, member, guild, client } = interaction;

    const type = options.getString('type');
    let leaderboardData = await fetchLeaderboardData(guild.id, type);
    let totalGuildLevels = 0, totalGuildVoice = 0, totalGuildMessages = 0;

    for (const data of leaderboardData) {
        totalGuildLevels += data.level;
        totalGuildVoice += data.totalVoice;
        totalGuildMessages += data.totalMessages;
    }

    if (!leaderboardData.length) {
        const noDataEmbed = new EmbedBuilder()
            .setColor('Red')
            .setDescription('0 users have earned xp in this guild, please send messages to earn xp');
        return await interaction.reply({ embeds: [noDataEmbed] });
    }

    leaderboardData = leaderboardData.slice(0, 15);

    const sortedLeaderboard = await sortLeaderboard(client, leaderboardData);

    let lb;
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
        .setTitle(`${guild.name} | ${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard`)
        .setThumbnail(guild.iconURL())
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
        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
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

async function handleAdminCommand(interaction) {
    const { options, member, guild, client } = interaction;
    const permissions = [PermissionFlagsBits.ManageGuild]
    const [hasPermissions, missingPermissions] = permissionCheck(interaction, permissions, member);

    if (!hasPermissions) {
        const Embed = new EmbedBuilder()
            .setColor('Red')
            .setDescription(`Bot Missing Permissions: \`${missingPermissions}\``);
        return await interaction.reply({ embeds: [Embed], ephemeral: true });
    }

    const adminType = options.getString('type');
    const adminAmount = options.getInteger('amount');
    const adminUser = options.getUser('user');

    switch (adminType) {
        case 'level':
            const levelData = await UserLevels.findOne({ guildId: guild.id, userId: adminUser.id });

            if (!levelData) {
                const NoLevelDataEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('User has no level data');
                return await interaction.reply({ embeds: [NoLevelDataEmbed], ephemeral: true });
            }

            levelData.level = adminAmount;
            levelData.xp = 0;
            await levelData.save();

            const LevelEmbed = new EmbedBuilder()
                .setColor('Blurple')
                .setDescription(`@${adminUser.username} level set to ${adminAmount}`);
            await interaction.reply({ embeds: [LevelEmbed] });

        break;

    case 'xp':
        const xpData = await UserLevels.findOne({ guildId: guild.id, userId: adminUser.id });

        if (!xpData) {
            const NoXPDataEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('User has no xp data');
            return await interaction.reply({ embeds: [NoXPDataEmbed], ephemeral: true });
        }



        const xpForLevel = ExpForLevel(xpData.level)
        const xpForNextLevel = ExpForLevel(xpData.level + 1)
        const maxAmount = xpForNextLevel - xpForLevel

        if (adminAmount > maxAmount) {
            const MaxAmountEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`Max amount of xp for this level is ${maxAmount}`);
            return await interaction.reply({ embeds: [MaxAmountEmbed], ephemeral: true });
        }

        xpData.xp = adminAmount;

        await xpData.save();

        const XPEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(`@${adminUser.username} xp set to ${adminAmount}`);
        await interaction.reply({ embeds: [XPEmbed] });       

        break; 
    case 'reset':
        const resetUserPermissions = [PermissionFlagsBits.ManageGuild]
        const [resetHasPermissions, resetMissingPermissions] = permissionCheck(interaction, resetUserPermissions, member);

        if (!resetHasPermissions) {
            const ResetEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`User Missing Permissions: \`${resetMissingPermissions}\``);
            return await interaction.reply({ embeds: [ResetEmbed], ephemeral: true });
        }

        const resetData = await UserLevels.findOne({ guildId: guild.id, userId: adminUser.id });

        if (!resetData) {
            const NoResetDataEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('User has no data to reset');
            return await interaction.reply({ embeds: [NoResetDataEmbed], ephemeral: true });
        }

        resetData.level = 0;
        resetData.xp = 0;
        resetData.totalMessages = 0;
        resetData.totalVoice = 0;

        await resetData.save();

        const ResetEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(`@${adminUser.username} data reset`);
        await interaction.reply({ embeds: [ResetEmbed] });
    }
}