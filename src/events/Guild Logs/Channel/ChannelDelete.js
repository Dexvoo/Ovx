const { Events, EmbedBuilder, Colors, PermissionFlagsBits } = require('discord.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
    name: Events.ChannelDelete,
    once: false,
    nickname: 'Channel Delete | Logs',


    /**
     * 
     * @param {import('../../../types.js').ChannelUtils} channel
     */

    async execute(channel) {
        const { client, guild } = channel;

        if(!guild) return;

        const LogsData = await LogsCache.get(guild.id);
        if(!LogsData || !LogsData?.channel?.enabled || !LogsData?.channel?.channelId) return client.utils.LogData('Channel Deleted', `Guild: ${guild.name} | Disabled`, 'warning');

        const logChannel = guild.channels.cache.get(LogsData.channel.channelId);
        if(!logChannel) {
            await LogsCache.setType(guild.id, 'channel', { enabled: false, channelId: null });
            return client.utils.LogData('Channel Deleted', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = client.utils.PermCheck(logChannel, botPermissions, client);
        if(!hasPermission) {
            await LogsCache.setType(guild.id, 'channel', { enabled: false, channelId: null });
            return client.utils.LogData('Channel Deleted', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        }

        const description = [
            `#${channel.name}`,
        ];

        const LogEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`Channel Deleted`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `CID: ${channel.id}` })
            .setTimestamp();

        logChannel.send({ embeds: [LogEmbed] })
            .then(() => client.utils.LogData('Channel Deleted', `Guild: ${guild.name} | Channel deleted in #${channel.name}`, 'info'))
            .catch(err => client.utils.LogData('Channel Deleted', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));



    }
};