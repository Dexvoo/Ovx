const { Events, EmbedBuilder, Colors, Message, PermissionFlagsBits } = require('discord.js');
const { consoleLogData } = require('../../../utils/LoggingData.js');
const LogsCache = require('../../../cache/Logs.js');
const { permissionCheck } = require('../../../utils/Permissions.js');

module.exports = {
    name: Events.MessageUpdate,
    once: false,
    nickname: 'Message Update | Logs',


    /**
     * 
     * @param {Message} oldMessage
     * @param {Message} newMessage
     * @returns 
     */

    async execute(oldMessage, newMessage) {
        const { client, guild, channel, content, author } = newMessage;

        if(author.bot || !guild || oldMessage.content === newMessage.content) return;

        const LogsData = await LogsCache.get(guild.id)
        if(!LogsData) return consoleLogData('Message Updated', `Guild: ${guild.name} | Disabled`, 'warning');

        const messageLogData = LogsData.message
        if(!messageLogData || !messageLogData.enabled || messageLogData.channelId === null) return consoleLogData('Member Left', `Guild: ${guild.name} | Disabled`, 'warning');
        
        const logChannel = guild.channels.cache.get(messageLogData.channelId);
        if(!logChannel) {
            await LogsCache.setType(guild.id, 'message', { enabled: false, channelId: null });
            return consoleLogData('Message Updated', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(logChannel, botPermissions, client);
        if(!hasPermission) {
            await LogsCache.setType(guild.id, 'message', { enabled: false, channelId: null });
            return consoleLogData('Message Updated', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        }
        
        const description = [
            `Old Content: \n-# ${oldMessage.content.substring(0, 1750)}`,
            `New Content: \n-# ${newMessage.content.substring(0, 1750)}`,
        ];

        if(!oldMessage.content) description.shift();
        if(!newMessage.content) description.pop();

        if(!content) description.shift();

        const LogEmbed = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setAuthor({ name: author.username, iconURL: author.displayAvatarURL({ size: 512, extension: 'png' }) })
            .setTitle(`Message Updated in #${channel.name}`)
            .setURL(`https://discord.com/channels/${guild.id}/${channel.id}/${newMessage.id}`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `UID: ${author.id} | MID: ${newMessage.id}` })
            .setTimestamp();

        logChannel.send({ embeds: [LogEmbed] })
            .then(() => consoleLogData('Message Updated', `Guild: ${guild.name} | Message by ${author.tag} updated in #${channel.name}`, 'info'))
            .catch(err => consoleLogData('Message Updated', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));



    }
};