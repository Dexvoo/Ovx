const { Events, EmbedBuilder, Colors, PermissionFlagsBits, GuildMember } = require('discord.js');
const { consoleLogData, Timestamp } = require('../../../utils/LoggingData.js');
const LogsCache = require('../../../cache/Logs.js');
const { permissionCheck } = require('../../../utils/Permissions.js');

module.exports = {
    name: Events.GuildMemberRemove,
    once: false,
    nickname: 'Member Leave | Logs',


    /**
     * 
     * @param {GuildMember} member
     */

    async execute(member) {
        const { client, guild } = member;

        if(!guild) return;

        const LogsData = await LogsCache.get(guild.id)
        if(!LogsData) return consoleLogData('Member Joined', `Guild: ${guild.name} | Disabled`, 'warning');
        
        const leaveLogData = LogsData.leave
        if(!leaveLogData || !leaveLogData.enabled || leaveLogData.channelId === null) return consoleLogData('Member Left', `Guild: ${guild.name} | Disabled`, 'warning');
        
        const logChannel = guild.channels.cache.get(leaveLogData.channelId);
        if(!logChannel) {
            await LogsCache.setType(guild.id, 'leave', { enabled: false, channelId: null });
            return consoleLogData('Member Left', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(logChannel, botPermissions, client);
        if(!hasPermission) {
            await LogsCache.setType(guild.id, 'leave', { enabled: false, channelId: null });
            return consoleLogData('Member Left', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        }
        
        const description = [
            `${member}`,
            `Joined: ${Timestamp(member.joinedAt, 'R')}`,
            `Roles: ${member.roles.cache.filter(role => role.name !== '@everyone').map(role => role).join(' • ').substring(0, 2000) || 'None'}`
        ];

        const LogEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL({ size: 512, extension: 'png' }) })
            .setTitle(`${member.user.bot ? 'Bot' : 'Member'} Left`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `UID: ${member.id}` })
            .setTimestamp();


        logChannel.send({ embeds: [LogEmbed] })
            .then(() => consoleLogData('Member Left', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username}`, 'info'))
            .catch(err => consoleLogData('Member Left', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
    }
};