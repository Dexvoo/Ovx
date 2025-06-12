const { Events, EmbedBuilder, Colors, PermissionFlagsBits, GuildMember } = require('discord.js');
const { consoleLogData, Timestamp, getOrdinalSuffix } = require('../../../utils/LoggingData.js');
const LogsCache = require('../../../cache/Logs.js');
const { permissionCheck } = require('../../../utils/Permissions.js');

module.exports = {
    name: Events.GuildMemberUpdate,
    once: false,
    nickname: 'Member Update | Logs',


    /**
     * 
     * @param {GuildMember} oldMember
     * @param {GuildMember} newMember
     */

    async execute(oldMember, newMember) {
        const { client, guild } = newMember;

        if(!guild) return;

        const LogsData = await LogsCache.get(guild.id);
        if(!LogsData) return consoleLogData('Member Updated', `Guild: ${guild.name} | Disabled`, 'warning');

        const joinLogData = LogsData.member
        if(!joinLogData || !joinLogData.enabled || joinLogData.channelId === null) return consoleLogData('Member Updated', `Guild: ${guild.name} | Disabled`, 'warning');
        
        const logChannel = guild.channels.cache.get(joinLogData.channelId);
        if(!logChannel) {
            await LogsCache.setType(guild.id, 'member', { enabled: false, channelId: null });
            return consoleLogData('Member Updated', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(logChannel, botPermissions, client);
        if(!hasPermission) {
            await LogsCache.setType(guild.id, 'member', { enabled: false, channelId: null });
            return consoleLogData('Member Updated', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        }
        
        const LogEmbed = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setAuthor({ name: newMember.user.username, iconURL: newMember.user.displayAvatarURL({ size: 512, extension: 'png' }) })
            .setTitle(`${newMember.user.bot ? 'Bot' : 'Member'} Updated`)
            .setFooter({ text: `UID: ${newMember.id}` })
            .setTimestamp();

        const [changes, newEmbed] = detectMemberChanges(oldMember, newMember, LogEmbed);

        if(changes.length === 0) return consoleLogData('Member Updated', `Guild: ${guild.name} | ${newMember.user.bot ? '🤖 Bot' : '👤 User'} @${newMember.user.username} | No Changes (timeouts are expected)`, 'error');



        logChannel.send({ embeds: [newEmbed] })
            .then(() => consoleLogData('Member Updated', `Guild: ${guild.name} | ${newMember.user.bot ? '🤖 Bot' : '👤 User'} @${newMember.user.username}`, 'info'))
            .catch(err => consoleLogData('Member Updated', `Guild: ${guild.name} | Failed to send log message: ${err.message}`, 'error'));



    }
};


/**
 * @param {GuildMember} oldMember
 * @param {GuildMember} newMember
 * @param {EmbedBuilder} embed 
 * @returns {string[]} Array of formatted change descriptions
 */
function detectMemberChanges(oldMember, newMember, embed) {
    const changes = [];

    if (oldMember.nickname !== newMember.nickname) {
        changes.push(`• **Nickname:** \`${oldMember.nickname || oldMember.displayName}\` → \`${newMember.nickname || newMember.displayName}\``);
    }

    // Per-server avatar change
    if (oldMember.avatar !== newMember.avatar) {
        embed.setThumbnail(newMember.avatar);
        changes.push(`• **Server Avatar:** Changed`);
    }

    // Global username
    if (oldMember.user.username !== newMember.user.username) {
        changes.push(`• **Username:** \`${oldMember.user.username}\` → \`${newMember.user.username}\``);
    }

    // Global display name (new username system)
    if (oldMember.user.globalName !== newMember.user.globalName) {
        changes.push(`• **Display Name:** \`${oldMember.user.globalName || 'None'}\` → \`${newMember.user.globalName || 'None'}\``);
    }

    // Global avatar
    if (oldMember.user.avatar !== newMember.user.avatar) {
        changes.push(`• **Avatar:** Changed`);
    }

    // Boosting status
    if (oldMember.premiumSince?.getTime() !== newMember.premiumSince?.getTime()) {
        if (newMember.premiumSince) {
            changes.push(`• **Started Boosting** at <t:${Math.floor(newMember.premiumSince.getTime() / 1000)}:F>`);
        } else {
            changes.push(`• **Stopped Boosting**`);
        }
    }

    // Pending screening status
    if (oldMember.pending !== newMember.pending) {
        if (!newMember.pending) {
            changes.push(`• **Completed Membership Screening**`);
        }
    }

    // Role changes
    const oldRoles = [...oldMember.roles.cache.keys()];
    const newRoles = [...newMember.roles.cache.keys()];

    const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
    const removedRoles = oldRoles.filter(r => !newRoles.includes(r));

    if (addedRoles.length > 0 || removedRoles.length > 0) {
        const added = addedRoles.map(r => `<@&${r}>`).join(', ');
        const removed = removedRoles.map(r => `<@&${r}>`).join(', ');

        if (added) changes.push(`• **Roles Added:** ${added}`);
        if (removed) changes.push(`• **Roles Removed:** ${removed}`);
    }

    return [changes, embed]
}