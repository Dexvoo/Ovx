const { Colors, EmbedBuilder, User } = require('discord.js');
const { LevelConfigType } = require('../../models/GuildSetups')
const { progressBar, ExpForLevel } = require('../../utils/Functions/Levels/XPMathematics')
const Cache_XP = require('../../cache/XP');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 * @param {{ guildConfig: LevelConfigType }} context
 */
module.exports = async function LevelsLeaderboard(interaction, context) {
    const { client, options, memberPermissions, guild } = interaction;

    const guildId= '980647156962713610';
    const { guildConfig } = context;

    if(!guildConfig) return client.utils.Embed(interaction, Colors.Red, 'Error Levels', `No configuration found for guild \`${guild.name}\``);
    if(!guildConfig.enabled) return client.utils.Embed(interaction, Colors.Red, 'Error Levels', `This guild hasn't configured levels for this server, advise an admin to use \`/levels setup\``);
    await client.utils.Embed(interaction, Colors.Blurple, `Gathering Information`, 'Getting data!', [], false);
    const type = options.getString('type') || 'level';
    /**
     * @typedef {Object} LeaderboardUserData
     * @property {string} rank
     * @property {number} level
     * @property {number} totalMessages
     * @property {number} totalVoice
     */
    /**
     * @typedef {(user: import('discord.js').User, data: LeaderboardUserData) => string} FormatFunction
     */
    /**
     * @typedef {Object} LeaderboardTypeConfig
     * @property {string} sortField
     * @property {FormatFunction} format
     */
    /** @type {Record<'level' | 'messages' | 'voice', LeaderboardTypeConfig>} */
    
    const typeConfig = {    
        level: {
            sortField: 'level',
            format: (user, data) => `\`${data.rank}.\` \`@${user.username.substring(0, 15).padEnd(15, ' ')}\` | ${client.CustomEmojis.levelling.Level} \`${data.level.toString().substring(0, 3).padEnd(3, ' ')}\`  ${client.CustomEmojis.levelling.XP} \`${data.xp.toString().substring(0, 6).padEnd(6, ' ')}\` ⌨️\`${data.totalMessages.toString().substring(0, 6).padEnd(6, ' ')}\` 🎙️\`${data.totalVoice.toString().substring(0, 6).padEnd(6, ' ')}\``
        },
        messages: {
            sortField: 'totalMessages',
            format: (user, data) => `\`${data.rank}.\` \`@${user.username.substring(0, 15).padEnd(15, ' ')}\` | ⌨️:\`${data.totalMessages.toLocaleString().substring(0, 7).padEnd(7, ' ')}\` ⌨️${client.CustomEmojis.levelling.XP} \`${data.messageXP.toLocaleString().substring(0, 10).padEnd(10, ' ')}\``
        },
        voice: {
            sortField: 'totalVoice',
            format: (user, data) => `\`${data.rank}.\` \`@${user.username.substring(0, 15).padEnd(15, ' ')}\` | 🎙️:\`${data.totalVoice.toLocaleString().substring(0, 7).padEnd(7, ' ')}\` 🎙️${client.CustomEmojis.levelling.XP} \`${data.voiceXP.toLocaleString().substring(0, 10).padEnd(10, ' ')}\``
        },
    };
    const config = typeConfig[type];
    if(!config) return client.utils.Embed(interaction, Colors.Red, 'Leaderboard Failed', `Invalid leaderboard type`);
    console.log(config.sortField)

    const topUsers = await Cache_XP.getTopUsers(guildId, config.sortField, client);
    const leaderboard = await Promise.all(
        topUsers.map(async (userData, i) => {
            const user = client.users.cache.get(userData.userId) || await client.users.fetch(userData.userId);
            return config.format(user, {
                ...userData, 
                rank: `${i + 1}`.padStart(2, ' ')
            });
        })
    ).then(lines =>lines.join('\n'));

    console.log(leaderboard.length)
    try {
        await client.utils.Embed(interaction, Colors.Blurple, `${guild.name} | ${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard 🏆`, leaderboard, [], false);   
    } catch (error) {
        await client.utils.Embed(interaction, Colors.Red, `Leaderboard Failed`, 'Disallowed Custom Emojis?');
    }
    
};