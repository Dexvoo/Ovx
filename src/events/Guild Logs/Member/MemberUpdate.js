const { Events, EmbedBuilder, Colors, PermissionFlagsBits, GuildMember } = require('discord.js');
const { getOrdinalSuffix } = require('../../../utils/Functions/LoggingData.js');
const LogsCache = require('../../../cache/Logs.js');

module.exports = {
    name: Events.GuildMemberUpdate,
    once: false,
    nickname: 'Member Update | Logs',


    /**
     * 
     * @param {import('../../../types.js').MemberUtils} oldMember
     * @param {import('../../../types.js').MemberUtils} newMember
     */

    async execute(oldMember, newMember) {
        const { client, guild } = newMember;

        if(!guild) return;

        const LogsData = await LogsCache.get(guild.id);
        if(!LogsData) return client.utils.LogData('Member Updated', `Guild: ${guild.name} | Disabled`, 'warning');

        const joinLogData = LogsData.member
        if(!joinLogData || !joinLogData.enabled || joinLogData.channelId === null) return client.utils.LogData('Member Updated', `Guild: ${guild.name} | Disabled`, 'warning');
        
        const logChannel = guild.channels.cache.get(joinLogData.channelId);
        if(!logChannel) {
            await LogsCache.setType(guild.id, 'member', { enabled: false, channelId: null });
            return client.utils.LogData('Member Updated', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = client.utils.PermCheck(logChannel, botPermissions, client);
        if(!hasPermission) {
            await LogsCache.setType(guild.id, 'member', { enabled: false, channelId: null });
            return client.utils.LogData('Member Updated', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        }
        
        const LogEmbed = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setAuthor({ name: newMember.user.username, iconURL: newMember.user.displayAvatarURL({ size: 512, extension: 'png' }) })
            .setTitle(`${newMember.user.bot ? 'Bot' : 'Member'} Updated`)
            .setFooter({ text: `UID: ${newMember.id}` })
            .setTimestamp();

        if (oldMember.nickname !== newMember.nickname) LogEmbed.addFields({ name: 'Nickname', value:`\`${oldMember.nickname || oldMember.displayName}\` → \`${newMember.nickname || newMember.displayName}\``, inline: false})

        // Per-server avatar change
        if (oldMember.avatar !== newMember.avatar) LogEmbed.addFields({ name: 'Server Avatar', value:`Updated`, inline: false}) && LogEmbed.setThumbnail(newMember.avatar);

        // Global username
        if (oldMember.user.username !== newMember.user.username) LogEmbed.addFields({ name: 'Username', value:`\`${oldMember.user.username}\` → \`${newMember.user.username}\``, inline: false})

        // Global display name (new username system)
        if (oldMember.user.globalName !== newMember.user.globalName) LogEmbed.addFields({ name: 'Display Name', value:`\`${oldMember.user.globalName || 'None'}\` → \`${newMember.user.globalName || 'None'}\``, inline: false})

        // Global avatar
        if (oldMember.user.avatar !== newMember.user.avatar) LogEmbed.addFields({ name: 'Server Avatar', value:`Updated`, inline: false});

        if (oldMember.premiumSinceTimestamp !== newMember.premiumSinceTimestamp) {
            if (newMember.premiumSince) LogEmbed.addFields({ name: 'Sever Boost', value:`${client.utils.Timestamp(newMember.premiumSince)}`, inline: false});
            else LogEmbed.addFields({ name: 'Sever Boost', value:`Stopped Boosting`, inline: false});
        }

        if (oldMember.pending !== newMember.pending) if (!newMember.pending) LogEmbed.addFields({ name: 'Membership Screening', value:`Completed`, inline: false});

        // Role changes
        const oldRoles = [...oldMember.roles.cache.keys()];
        const newRoles = [...newMember.roles.cache.keys()];

        const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
        const removedRoles = oldRoles.filter(r => !newRoles.includes(r));

        if (addedRoles.length > 0 || removedRoles.length > 0) {
            const added = addedRoles.map(r => `<@&${r}>`).join(', ');
            const removed = removedRoles.map(r => `<@&${r}>`).join(', ');

            if (added) LogEmbed.addFields({ name: `Added Roles`, value: `${added.substring(0, 1024)}`});
            if (removed) LogEmbed.addFields({ name: `Removed Roles`, value: `${removed.substring(0, 1024)}`});
        }

        if(LogEmbed.data.fields?.length === 0) return client.utils.LogData('Member Updated', `Guild: ${guild.name} | ${newMember.user.bot ? '🤖 Bot' : '👤 User'} @${newMember.user.username} | No Changes (timeouts are expected)`, 'error');

        logChannel.send({ embeds: [LogEmbed] })
            .then(() => client.utils.LogData('Member Updated', `Guild: ${guild.name} | ${newMember.user.bot ? '🤖 Bot' : '👤 User'} @${newMember.user.username}`, 'info'))
            .catch(err => client.utils.LogData('Member Updated', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));
    }
};