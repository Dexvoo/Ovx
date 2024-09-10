const { Events, Client, EmbedBuilder, Colors } = require('discord.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const BotStats = require('../../models/BotStats.js');
const { DeveloperMode } = process.env;

module.exports = {
    name: Events.ClientReady,
    once: true,
    nickname: 'Bot Stats',

    /**
     * @param {Client} client
     */
    async execute(client) {
        const startTime = Date.now();


        const statsChannelId = '1115340622027575306'
        const devMessageId = '1158595086116999238'
        const publicMessageId = '1158549863546499143'


        const messageId = DeveloperMode ? devMessageId : publicMessageId;
        const channel = client.channels.cache.get(statsChannelId);
        const messageToEdit = await channel.messages.fetch(messageId);

        const getStats = async () => {
            const botStatsData = await BotStats.findOne({ client: client.user.id }).catch(err => console.error(err));

            if (!botStatsData) {
                const newBotStats = new BotStats({
                    client: client.user.id,
                    guilds: client.guilds.cache.size,
                    users: client.users.cache.size,
                    channels: client.channels.cache.size,
                    uptime: 0,
                    emojis: client.emojis.cache.size,
                    roles: client.guilds.cache.reduce((a, g) => a + g.roles.cache.size, 0),
                });

                await newBotStats.save().catch(err => console.error(err));
            }

            // Collect current stats
            const stats = {
                guilds: client.guilds.cache.size,
                users: client.users.cache.size,
                channels: client.channels.cache.size,
                uptime: Math.floor((Date.now() - startTime) / 1000),
                emojis: client.emojis.cache.size,
                roles: client.guilds.cache.reduce((a, g) => a + g.roles.cache.size, 0),
            };

            // Log and update stats if they have increased
            for (const key in stats) {
                if (stats[key] > botStatsData[key]) {
                    botStatsData[key] = stats[key];
                    cleanConsoleLogData('Bot Stats', `New ${key.charAt(0).toUpperCase() + key.slice(1)} Statistic: ${stats[key].toLocaleString()}`, 'success');
                }
            }

            await botStatsData.save().catch(err => console.error(err));

            cleanConsoleLogData(
                'Bot Stats',
                `Guilds: ${stats.guilds.toLocaleString()} | Users: ${stats.users.toLocaleString()} | Channels: ${stats.channels.toLocaleString()} | Roles: ${stats.roles.toLocaleString()} | Uptime: ${formatTime(stats.uptime)} | Emojis: ${stats.emojis.toLocaleString()}`,
                'debug'
            );

            const embed = new EmbedBuilder()
                .setTitle('Bot Top Statistics')
                .setColor(Colors.Blurple)
                .addFields(
                    { name: 'Guilds', value: stats.guilds.toLocaleString(), inline: true },
                    { name: 'Users', value: stats.users.toLocaleString(), inline: true },
                    { name: 'Channels', value: stats.channels.toLocaleString(), inline: true },
                    { name: 'Roles', value: stats.roles.toLocaleString(), inline: true },
                    { name: 'Emojis', value: stats.emojis.toLocaleString(), inline: true },
                    { name: 'Last Updated', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                    { name: 'Best Uptime', value: formatTime(botStatsData.uptime), inline: false },
                    { name: 'Current Uptime', value: `<t:${Math.floor(startTime / 1000)}:R>`, inline: false }
                )
                .setTimestamp();

            await messageToEdit.edit({ embeds: [embed] });
        };

        setInterval(getStats, 60000 * 10);
        getStats();
    }
};

function formatTime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hrs = Math.floor((seconds % (3600 * 24)) / 3600);
    const mnts = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${days}d ${hrs}h ${mnts}m`;
}
