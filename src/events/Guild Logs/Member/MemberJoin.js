const { Events, EmbedBuilder, Colors, PermissionFlagsBits, GuildMember } = require('discord.js');
const { consoleLogData, Timestamp, getOrdinalSuffix } = require('../../../utils/LoggingData.js');
const LogsCache = require('../../../cache/Logs.js');
const { permissionCheck } = require('../../../utils/Permissions.js');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    nickname: 'Member Join | Logs',


    /**
     * 
     * @param {GuildMember} member
     */

    async execute(member) {
        const { client, guild } = member;

        if(!guild) return;

        const LogsData = await LogsCache.get(guild.id);

        if(!LogsData) return consoleLogData('Member Joined', `Guild: ${guild.name} | Disabled`, 'warning');

        const joinLogData = LogsData.join
        if(!joinLogData || !joinLogData.enabled || joinLogData.channelId === null) return consoleLogData('Member Joined', `Guild: ${guild.name} | Disabled`, 'warning');
        
        const logChannel = guild.channels.cache.get(joinLogData.channelId);
        if(!logChannel) {
            await LogsCache.setType(guild.id, 'join', { enabled: false, channelId: null });
            return consoleLogData('Member Joined', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(logChannel, botPermissions, client);
        if(!hasPermission) {
            await LogsCache.setType(guild.id, 'join', { enabled: false, channelId: null });
            return consoleLogData('Member Joined', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        }
        
        const memberCount = guild.memberCount;

        const description = [
            `${member}, ${memberCount}${getOrdinalSuffix(guild.memberCount)} to join`,
            `Created: ${Timestamp(member.user.createdAt, 'F')} (${Timestamp(member.user.createdAt, 'R')})`,
        ];

        const LogEmbed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL({ size: 512, extension: 'png' }) })
            .setTitle(`${member.user.bot ? 'Bot' : 'Member'} Joined`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `UID: ${member.id}` })
            .setTimestamp();


        logChannel.send({ embeds: [LogEmbed] })
            .then(() => consoleLogData('Member Joined', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username}`, 'info'))
            .catch(err => consoleLogData('Member Joined', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));



    }
};