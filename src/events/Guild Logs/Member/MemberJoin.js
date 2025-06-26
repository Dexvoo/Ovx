const { Events, EmbedBuilder, Colors, PermissionFlagsBits } = require('discord.js');
const { getOrdinalSuffix } = require('../../../utils/Functions/LoggingData.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    nickname: 'Member Join | Logs',


    /**
     * 
     * @param {import('../../../types.js').MemberUtils} member
     */

    async execute(member) {
        const { client, guild } = member;

        if(!guild) return;

        const LogsData = await LogsCache.get(guild.id);

        if(!LogsData) return client.utils.LogData('Member Joined', `Guild: ${guild.name} | Disabled`, 'warning');

        const joinLogData = LogsData.join
        if(!joinLogData || !joinLogData.enabled || joinLogData.channelId === null) return client.utils.LogData('Member Joined', `Guild: ${guild.name} | Disabled`, 'warning');
        
        const logChannel = guild.channels.cache.get(joinLogData.channelId);
        if(!logChannel) {
            await LogsCache.setType(guild.id, 'join', { enabled: false, channelId: null });
            return client.utils.LogData('Member Joined', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = client.utils.PermCheck(logChannel, botPermissions, client);
        if(!hasPermission) {
            await LogsCache.setType(guild.id, 'join', { enabled: false, channelId: null });
            return client.utils.LogData('Member Joined', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        }
        
        const memberCount = guild.memberCount;

        const description = [
            `${member}, ${memberCount}${getOrdinalSuffix(guild.memberCount)} to join`,
            `Created: ${client.utils.Timestamp(member.user.createdAt, 'F')} (${client.utils.Timestamp(member.user.createdAt, 'R')})`,
        ];

        const LogEmbed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL({ size: 512, extension: 'png' }) })
            .setTitle(`${member.user.bot ? 'Bot' : 'Member'} Joined`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `UID: ${member.id}` })
            .setTimestamp();


        logChannel.send({ embeds: [LogEmbed] })
            .then(() => client.utils.LogData('Member Joined', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username}`, 'info'))
            .catch(err => client.utils.LogData('Member Joined', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));



    }
};