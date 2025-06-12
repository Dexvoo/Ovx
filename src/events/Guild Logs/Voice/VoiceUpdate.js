const { Events, EmbedBuilder, Colors, PermissionFlagsBits, GuildMember, VoiceState } = require('discord.js');
const { consoleLogData, Timestamp, getOrdinalSuffix } = require('../../../utils/LoggingData.js');
const LogsCache = require('../../../cache/Logs.js');
const { permissionCheck } = require('../../../utils/Permissions.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,
    nickname: 'Voice Update | Logs',


    /**
     * 
     * @param {VoiceState} oldState
     * @param {VoiceState} newState
     */

    async execute(oldState, newState) {
        const { guild, member, client, channel } = newState;

        if(!guild) return;

        const LogsData = await LogsCache.get(guild.id);
        if(!LogsData) return consoleLogData('Voice Updated', `Guild: ${guild.name} | Disabled`, 'warning');

        const joinLogData = LogsData.voice;
        if(!joinLogData || !joinLogData.enabled || joinLogData.channelId === null) return consoleLogData('Voice Updated', `Guild: ${guild.name} | Disabled`, 'warning');
        
        const logChannel = guild.channels.cache.get(joinLogData.channelId);
        if(!logChannel) {
            await LogsCache.setType(guild.id, 'voice', { enabled: false, channelId: null });
            return consoleLogData('Voice Updated', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        };

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(logChannel, botPermissions, client);
        if(!hasPermission) {
            await LogsCache.setType(guild.id, 'voice', { enabled: false, channelId: null });
            return consoleLogData('Voice Updated', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        };
    
        const LogEmbed = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL({ size: 512, extension: 'png' }) })
            .setFooter({ text: `UID: ${member.id} | CID: ${channel ? channel.id : 'Not Found'}` })
            .setTimestamp();

        if(!oldState.channel && newState.channel) {
            LogEmbed.setTitle(`Member Joined Voice Channel`)
            LogEmbed.setColor(Colors.Green)
            LogEmbed.setDescription(`${newState.channel}`)
            return logChannel.send({ embeds: [LogEmbed] })
                .then(() => consoleLogData('Voice Joined New', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username} | Channel: #${channel ? channel.name : 'Not Found'}`, 'info'))
                .catch(err => consoleLogData('Voice Joined New', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
        };

        if(oldState.channel && !newState.channel) {
            LogEmbed.setTitle(`Member Left Voice Channel`)
            LogEmbed.setColor(Colors.Red)
            LogEmbed.setDescription(`${oldState.channel}`)
            return logChannel.send({ embeds: [LogEmbed] })
                .then(() => consoleLogData('Voice Left', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username} | Channel: #${oldState.channel ? oldState.channel.name : 'Not Found'}`, 'info'))
                .catch(err => consoleLogData('Voice Left', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
        };

        if(!channel) {
            LogEmbed.setTitle(`Member Left Voice Channel`)
            LogEmbed.setColor(Colors.Red)
            return logChannel.send({ embeds: [LogEmbed] })
                .then(() => consoleLogData('Voice Left', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username}`, 'info'))
                .catch(err => consoleLogData('Voice Left', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
        };

        if(oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            LogEmbed.setTitle(`Member Switched Voice Channel`)
            LogEmbed.setColor(Colors.Green)
            LogEmbed.setDescription(`${oldState.channel} => ${newState.channel}`)
            return logChannel.send({ embeds: [LogEmbed] })
                .then(() => consoleLogData('Voice Switched', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username} | Channel: #${oldState.channel.name} => #${channel.name}`, 'info'))
                .catch(err => consoleLogData('Voice Switched', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
        };

        if(oldState.serverDeaf && !newState.serverDeaf) {
            LogEmbed.setTitle(`Member Server Undeafened`)
            LogEmbed.setColor(Colors.Green)
            LogEmbed.setDescription(`${oldState.channel}`)
            return logChannel.send({ embeds: [LogEmbed] })
                .then(() => consoleLogData('Voice Undeafened', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username} | Channel: #${channel.name}`, 'info'))
                .catch(err => consoleLogData('Voice Undeafened', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
        };

        if(!oldState.serverDeaf && newState.serverDeaf) {
            LogEmbed.setTitle(`Member Server Deafened`)
            LogEmbed.setColor(Colors.Red)
            LogEmbed.setDescription(`${newState.channel}`)
            return logChannel.send({ embeds: [LogEmbed] })
                .then(() => consoleLogData('Voice Deafened', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username} | Channel: #${channel.name}`, 'info'))
                .catch(err => consoleLogData('Voice Deafened', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
        };

        if(oldState.serverMute && !newState.serverMute) {
            LogEmbed.setTitle(`Member Server Unmuted`)
            LogEmbed.setColor(Colors.Green)
            LogEmbed.setDescription(`${oldState.channel}`)
            return logChannel.send({ embeds: [LogEmbed] })
                .then(() => consoleLogData('Voice Unmuted', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username} | Channel: #${channel.name}`, 'info'))
                .catch(err => consoleLogData('Voice Unmuted', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
        };

        if(!oldState.serverMute && newState.serverMute) {
            LogEmbed.setTitle(`Member Server Muted`)
            LogEmbed.setColor(Colors.Red)
            LogEmbed.setDescription(`${newState.channel}`)
            return logChannel.send({ embeds: [LogEmbed] })
                .then(() => consoleLogData('Voice Muted', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username} | Channel: #${channel.name}`, 'info'))
                .catch(err => consoleLogData('Voice Muted', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
        };

        if(oldState.selfVideo && !newState.selfVideo) {
            LogEmbed.setTitle(`Member Disabled Video`)
            LogEmbed.setColor(Colors.Red)
            LogEmbed.setDescription(`${oldState.channel}`)
            return logChannel.send({ embeds: [LogEmbed] })
                .then(() => consoleLogData('Voice Disable Video', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username} | Channel: #${channel.name}`, 'info'))
                .catch(err => consoleLogData('Voice Disable Video', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
        }

        if(!oldState.selfVideo && newState.selfVideo) {
            LogEmbed.setTitle(`Member Enabled Video`)
            LogEmbed.setColor(Colors.Green)
            LogEmbed.setDescription(`${newState.channel}`)
            return logChannel.send({ embeds: [LogEmbed] })
                .then(() => consoleLogData('Voice Enable Video', `Guild: ${guild.name} | ${member.user.bot ? '🤖 Bot' : '👤 User'} @${member.user.username} | Channel: #${channel.name}`, 'info'))
                .catch(err => consoleLogData('Voice Enable Video', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
        }


        consoleLogData('Voice Update Logs', `Should not get here, if so im missing events`, 'error')





    }
};