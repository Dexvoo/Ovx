const { Events, EmbedBuilder, Colors, PermissionFlagsBits } = require('discord.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
    name: Events.GuildBanRemove,
    once: false,
    nickname: 'Punishment Unban | Logs',


    /**
     * 
     * @param {import('../../../types.js').BanUtils} ban
     */

    async execute(ban) {
        const { client, guild, user, reason } = ban;

        if(!guild) return;

        const LogsData = await LogsCache.get(guild.id);
        if(!LogsData) return client.utils.LogData('Punishment Unban', `Guild: ${guild.name} | Disabled`, 'warning');

        const joinLogData = LogsData.punishment
        if(!joinLogData || !joinLogData.enabled || joinLogData.channelId === null) return client.utils.LogData('Punishment Unban', `Guild: ${guild.name} | Disabled`, 'warning');
        
        const logChannel = guild.channels.cache.get(joinLogData.channelId);
        if(!logChannel) {
            await LogsCache.setType(guild.id, 'punishment', { enabled: false, channelId: null });
            return client.utils.LogData('Punishment Unban', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = client.utils.PermCheck(logChannel, botPermissions, client);
        if(!hasPermission) {
            await LogsCache.setType(guild.id, 'punishment', { enabled: false, channelId: null });
            return client.utils.LogData('Punishment Unban', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        }
        

        const description = [
            `Username: @${user.username}`,
            `Banned Reason: ${reason || 'No reason provided'}`,
        ];

        const LogEmbed = new EmbedBuilder()
            .setColor(Colors.Yellow)
            .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ size: 512, extension: 'png' }) })
            .setTitle(`${user.bot ? 'Bot' : 'User'} Unbanned`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `UID: ${user.id}` })
            .setTimestamp();


        logChannel.send({ embeds: [LogEmbed] })
            .then(() => client.utils.LogData('Punishment Unban', `Guild: ${guild.name} | ${user.bot ? '🤖 Bot' : '👤 User'} @${user.username}`, 'info'))
            .catch(err => client.utils.LogData('Punishment Unban', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));



    }
};