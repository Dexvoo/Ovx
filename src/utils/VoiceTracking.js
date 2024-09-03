const { cleanConsoleLogData } =require('./ConsoleLogs.js');

// Function to check users already in voice channels when the bot starts
async function checkUsersInVoiceChannels(client, inVoiceChannelMembers) {
    client.guilds.cache.forEach((guild) => {
        guild.channels.cache
            .filter((channel) => channel.isVoiceBased())
            .forEach((voiceChannel) => {
                voiceChannel.members.forEach((member) => {
                    if (!member.user.bot) {
                        inVoiceChannelMembers.set(member.user.id, {
                            channel: voiceChannel,
                            time: Date.now(), // Set the join time to the time when the bot starts
                        });
                        cleanConsoleLogData(
                            'Voice Log',
                            `User ${member.user.username} is already in voice channel ${voiceChannel.name}`,
                            'info'
                        );
                    }
                });
            });
    });
}

module.exports = { checkUsersInVoiceChannels };