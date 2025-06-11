const { Events, EmbedBuilder, Colors, Message, PermissionFlagsBits, GuildChannel } = require('discord.js');
const { consoleLogData } = require('../../../utils/LoggingData.js');
const LogsCache = require('../../../cache/Logs.js');
const { permissionCheck } = require('../../../utils/Permissions.js');

module.exports = {
    name: Events.MessageBulkDelete,
    once: false,
    nickname: 'Message Bulk Delete | Logs',


    /**
     * 
     * @param {Message} messages
     * @param {GuildChannel} channel
     * @returns 
     */

    async execute(messages, channel) {
        const { client, guild } = channel;
        
        if(!guild) return;

        const LogsData = await LogsCache.get(guild.id);
        if(!LogsData || !LogsData?.message?.enabled || !LogsData?.message?.channelId) return consoleLogData('Message Bulk Delete', `Guild: ${guild.name} | Disabled`, 'warning');

        const logChannel = guild.channels.cache.get(LogsData.message.channelId);
        if(!logChannel) {
            await LogsCache.setType(guild.id, 'message', { enabled: false, channelId: null });
            return consoleLogData('Message Bulk Delete', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(logChannel, botPermissions, client);
        if(!hasPermission) {
            await LogsCache.setType(guild.id, 'message', { enabled: false, channelId: null });
            return consoleLogData('Message Bulk Delete', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        }
        
        const description = [
            `${messages.size} messages`,
        ];

        const LogEmbed = new EmbedBuilder()
            .setColor(Colors.DarkRed)
            .setTitle(`Message Bulk Deleted in #${channel.name}`)
            .setURL(`https://discord.com/channels/${guild.id}/${channel.id}/${messages.last().id}`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `CID: ${channel.id}` })
            .setTimestamp();

        logChannel.send({ embeds: [LogEmbed] })
            .then(() => consoleLogData('Message Bulk Deleted', `Guild: ${guild.name} | Message bulk deleted in #${channel.name}`, 'info'))
            .catch(err => consoleLogData('Message Bulk Deleted', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));



    }
};