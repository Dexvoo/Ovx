// Unused imports removed for cleanliness.
const { Colors, User } = require('discord.js');
const { LevelConfigType } = require('../../models/GuildSetups');
const Cache_XP = require('../../cache/XP');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 * @param {{ guildConfig: LevelConfigType }} context
 */
module.exports = async function LevelsLeaderboard(interaction, context) {
    const { client, options, guild, guildId } = interaction;
    const { guildConfig } = context;

    if (!guildConfig) return client.utils.Embed(interaction, Colors.Red, 'Error Levels', `No configuration found for guild \`${guild.name}\``);
    if (!guildConfig.enabled) return client.utils.Embed(interaction, Colors.Red, 'Error Levels', `This guild hasn't configured levels for this server, advise an admin to use \`/levels setup\``);
    
    await interaction.deferReply();

    const type = options.getString('type') || 'level';

    /**
     * @typedef {Object} LeaderboardUserData
     * @property {string} userId
     * @property {string} rank
     * @property {number} level
     * @property {number} xp
     * @property {number} totalMessages
     * @property {number} messageXP
     * @property {number} totalVoice
     * @property {number} voiceXP
     */
    /**
     * @typedef {(user: User, data: LeaderboardUserData) => string} FormatFunction
     */
    /**
     * @typedef {Object} LeaderboardTypeConfig
     * @property {string} sortField The field to sort by in the database/cache query.
     * @property {FormatFunction} format A function to format a single line of the leaderboard.
     */
    /** @type {Record<'level' | 'messages' | 'voice', LeaderboardTypeConfig>} */
    const typeConfig = {
        level: {
            sortField: 'level',
            format: (user, data) => {
                const rank = `\`${data.rank}.\``.padEnd(4);
                const name = `\`@${user.username.substring(0, 15).padEnd(15)}\``;
                const level = `${client.CustomEmojis.levelling.Level} \`${data.level.toString().padEnd(3)}\``;
                const xp = `${client.CustomEmojis.levelling.XP} \`${data.xp.toLocaleString().padEnd(6)}\``;
                const messages = `⌨️ \`${data.totalMessages.toLocaleString().padEnd(6)}\``;
                const voice = `🎙️ \`${(data.totalVoice / 60).toFixed(1).padEnd(5)}h\``;
                return `${rank} ${name} | ${level} ${xp} | ${messages} ${voice}`;
            }
        },
        messages: {
            sortField: 'totalMessages',
            format: (user, data) => {
                const rank = `\`${data.rank}.\``.padEnd(4);
                const name = `\`@${user.username.substring(0, 15).padEnd(15)}\``;
                const messages = `⌨️ \`${data.totalMessages.toLocaleString().padEnd(7)}\``;
                const xp = `⌨️${client.CustomEmojis.levelling.XP} \`${data.messageXP.toLocaleString().padEnd(10)}\``;
                return `${rank} ${name} | ${messages} ${xp}`;
            }
        },
        voice: {
            sortField: 'totalVoice',
            format: (user, data) => {
                const rank = `\`${data.rank}.\``.padEnd(4);
                const name = `\`@${user.username.substring(0, 15).padEnd(15)}\``;
                const voice = `🎙️ \`${data.totalVoice.toLocaleString().padEnd(7)}\``;
                const xp = `🎙️${client.CustomEmojis.levelling.XP} \`${data.voiceXP.toLocaleString().padEnd(10)}\``;
                return `${rank} ${name} | ${voice} ${xp}`;
            }
        },
    };

    const config = typeConfig[type];
    if (!config) return client.utils.Embed(interaction, Colors.Red, 'Leaderboard Failed', 'Invalid leaderboard type');

    const topUsersData = await Cache_XP.getTopUsers(guildId, config.sortField, client);
    const userPromises = topUsersData.map(async (userData, i) => {
        try {
            const user = client.users.cache.get(userData.userId) || await client.users.fetch(userData.userId);
            const rankedData = { ...userData, rank: `${i + 1}`.padStart(2, ' ') };
            return config.format(user, rankedData);
        } catch (error) {
            console.error(`Could not fetch user ${userData.userId} for leaderboard:`, error);
            return null;
        }
    });

    const settledResults = await Promise.allSettled(userPromises);
    const leaderboardLines = settledResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);

    if (leaderboardLines.length === 0) {
        return client.utils.Embed(interaction, Colors.Orange, 'Leaderboard Empty', 'There is no data to display on the leaderboard yet.');
    }

    const leaderboard = leaderboardLines.join('\n');

    try {
        const title = `${guild.name} | ${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard 🏆`;
        const description = leaderboard.length > 4096 ? leaderboard.substring(0, 4093) + '...' : leaderboard;
        
        await client.utils.Embed(interaction, Colors.Blurple, title, description, [], false);
    } catch (error) {
        console.error('Failed to send leaderboard embed:', error);
        await client.utils.Embed(interaction, Colors.Red, 'Leaderboard Failed', 'An error occurred while displaying the leaderboard. This could be due to invalid emoji permissions or another issue.');
    }
};