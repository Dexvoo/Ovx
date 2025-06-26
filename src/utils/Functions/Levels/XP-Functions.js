const { Client } = require('discord.js');
const { UserLevels } = require('../../models/UserSetups');



/**
* @param {String} guildId - The amount of minutes the user has been in the voice channel
* @param {String} type - level, messages, or voice
*/

async function fetchLeaderboardData(guildId, type) {
    if (!guildId) throw new Error('No guildId provided');
    if (!type) throw new Error('No type provided');

    let leaderboardData;

    switch (type) {
        case 'levels':
            leaderboardData = await UserLevels.find({ guildId }).sort({ level: -1, xp: -1 }).limit(15);
            break;
        case 'messages':
            leaderboardData = await UserLevels.find({ guildId }).sort({ totalMessages: -1 }).limit(15);
            break;
        case 'voice':
            leaderboardData = await UserLevels.find({ guildId }).sort({ totalVoice: -1 }).limit(15);
            break;
        default:
            throw new Error('Invalid type provided');
    }

    return leaderboardData;
}

/**
* @param {Client} client - The Discord Client
* @param {Array} leaderboard - The leaderboard data
*/

async function sortLeaderboard(client, leaderboard) {
    if (!client) throw new Error('No client provided');
    if (!leaderboard) throw new Error('No leaderboard provided');

    let sortedLeaderboard = [];

    for (const data of leaderboard) {
        var user = client.users.cache.get(data.userId);

        if (!user) {
            user = await client.users.fetch(data.userId);
		}

        const guild = client.guilds.cache.get(data.guildId);

        sortedLeaderboard.push({
            guildName: guild.name,
            userId: data.userId,
            xp: data.xp,
            level: data.level,
            totalMessages: data.totalMessages,
            totalVoice: data.totalVoice,
            position: leaderboard.indexOf(data) + 1,
            username: user.username,
        });

    }

    return sortedLeaderboard;
    
}

module.exports = { fetchLeaderboardData, sortLeaderboard };