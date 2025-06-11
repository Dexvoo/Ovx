const { Events, EmbedBuilder, Colors, Message, PermissionFlagsBits } = require('discord.js');
const { consoleLogData } = require('../../../utils/LoggingData.js');
const LogsCache = require('../../../cache/Logs.js');
const { permissionCheck } = require('../../../utils/Permissions.js');

module.exports = {
    name: Events.MessageDelete,
    once: false,
    nickname: 'Channel Delete | Logs',


    /**
     * 
     * @param {Message} message
     * @returns 
     */

    async execute(message) {
        const { client, guild, channel, content, author } = message;

        if(author.bot || !guild) return;

        const LogsData = await LogsCache.get(guild.id);
        if(!LogsData || !LogsData?.message?.enabled || !LogsData?.message?.channelId) return consoleLogData('Message Deleted', `Guild: ${guild.name} | Disabled`, 'warning');

        const logChannel = guild.channels.cache.get(LogsData.message.channelId);
        if(!logChannel) {
            await LogsCache.setType(guild.id, 'message', { enabled: false, channelId: null });
            return consoleLogData('Message Deleted', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(logChannel, botPermissions, client);
        if(!hasPermission) {
            await LogsCache.setType(guild.id, 'message', { enabled: false, channelId: null });
            return consoleLogData('Message Deleted', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        }
        
        const attachments = message.attachments.map(attachment => attachment.url).join('\n');
        const description = [
            `-# ${content.substring(0, 2000)}\n`,
        ];

        if(!content) description.shift();
        if(attachments) description.push(`### Attachments:\n${attachments}`);

        const LogEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setAuthor({ name: author.username, iconURL: author.displayAvatarURL({ size: 512, extension: 'png' }) })
            .setTitle(`Message Deleted in #${channel.name}`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `UID: ${author.id} | MID: ${message.id}` })
            .setTimestamp();

        logChannel.send({ embeds: [LogEmbed] })
            .then(() => consoleLogData('Message Deleted', `Guild: ${guild.name} | Message by ${author.tag} deleted in #${channel.name}`, 'info'))
            .catch(err => consoleLogData('Message Deleted', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));



    }
};