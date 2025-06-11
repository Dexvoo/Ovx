const { Events, EmbedBuilder, Colors, PermissionFlagsBits, GuildChannel, PermissionsBitField, ChannelType } = require('discord.js');
const { consoleLogData } = require('../../../utils/LoggingData.js');
const LogsCache = require('../../../cache/Logs.js');
const { permissionCheck } = require('../../../utils/Permissions.js');

module.exports = {
    name: Events.ChannelUpdate,
    once: false,
    nickname: 'Channel Update | Logs',

    /**
     * @param {GuildChannel} oldChannel
     * @param {GuildChannel} newChannel
     */
    async execute(oldChannel, newChannel) {
        const { client, guild } = newChannel;
        if (!guild) return;

        const LogsData = await LogsCache.get(guild.id);
        if (!LogsData?.channel?.enabled || !LogsData.channel.channelId) {
            return consoleLogData('Channel Updated', `Guild: ${guild.name} | Disabled`, 'warning');
        }

        const logChannel = guild.channels.cache.get(LogsData.channel.channelId);
        if (!logChannel) {
            await LogsCache.setType(guild.id, 'channel', { enabled: false, channelId: null });
            return consoleLogData('Channel Updated', `Guild: ${guild.name} | Log Channel not found, disabling logs`, 'error');
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission] = permissionCheck(logChannel, botPermissions, client);
        if (!hasPermission) {
            await LogsCache.setType(guild.id, 'channel', { enabled: false, channelId: null });
            return consoleLogData('Channel Updated', `Guild: ${guild.name} | Bot missing permissions in log channel, disabling logs`, 'error');
        }

        const description = [];

        let positionChanged = false;
        if (oldChannel.rawPosition !== newChannel.rawPosition) {
            positionChanged = true;
            description.push(`**Position:** \`${oldChannel.rawPosition}\` → \`${newChannel.rawPosition}\``);
        }

        // Name
        if (oldChannel.name !== newChannel.name) {
            description.push(`**Name:** \`${oldChannel.name}\` → \`${newChannel.name}\``);
        }

        // Type
        if (oldChannel.type !== newChannel.type) {
            description.push(`**Type:** \`${ChannelType[oldChannel.type]}\` → \`${ChannelType[newChannel.type]}\``);
        }

        // Topic (Text/Forum)
        if ('topic' in oldChannel && oldChannel.topic !== newChannel.topic) {
            description.push(`**Topic:** \`${oldChannel.topic || 'None'}\` → \`${newChannel.topic || 'None'}\``);
        }

        // NSFW
        if ('nsfw' in oldChannel && oldChannel.nsfw !== newChannel.nsfw) {
            description.push(`**NSFW:** ${oldChannel.nsfw ? 'Yes' : 'No'} → ${newChannel.nsfw ? 'Yes' : 'No'}`);
        }

        // Slowmode
        if ('rateLimitPerUser' in oldChannel && oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
            description.push(`**Slowmode:** \`${oldChannel.rateLimitPerUser || 0}s\` → \`${newChannel.rateLimitPerUser || 0}s\``);
        }

        // Bitrate (Voice)
        if ('bitrate' in oldChannel && oldChannel.bitrate !== newChannel.bitrate) {
            description.push(`**Bitrate:** \`${oldChannel.bitrate / 1000}kbps\` → \`${newChannel.bitrate / 1000}kbps\``);
        }

        // User limit (Voice)
        if ('userLimit' in oldChannel && oldChannel.userLimit !== newChannel.userLimit) {
            description.push(`**User Limit:** \`${oldChannel.userLimit || 0}\` → \`${newChannel.userLimit || 0}\``);
        }

        // Parent Category
        if ((oldChannel.parentId || null) !== (newChannel.parentId || null)) {
            description.push(`**Category:** \`${oldChannel.parent?.name || 'None'}\` → \`${newChannel.parent?.name || 'None'}\``);
        }

        // Permission overwrites
        const oldPerms = oldChannel.permissionOverwrites.cache;
        const newPerms = newChannel.permissionOverwrites.cache;

        const changedPerms = [];

        newPerms.forEach((perm, id) => {
            const old = oldPerms.get(id);
            if (!old) {
                changedPerms.push(`**Permission Added for ${perm.type === 0 ? `<@&${id}>**\n${formatPermissions(perm)}` : `<@${id}>**\n${formatPermissions(perm)}`} in **#${newChannel.name}**`);
                return;
            }

            const diff = comparePermissionDiff(old, perm);
            if (diff) changedPerms.push(`**Permission Updated for ${perm.type === 0 ? `<@&${id}>**\n${diff}` : `<@${id}>**\n${diff}`} in **#${newChannel.name}**`);
        });

        oldPerms.forEach((perm, id) => {
            if (!newPerms.has(id)) {
                changedPerms.push(`**Permission Removed for ${perm.type === 0 ? `<@&${id}>**\n${formatPermissions(perm)}` : `<@${id}>**\n${formatPermissions(perm)}`} in **#${newChannel.name}**`);
            }
        });

        if (changedPerms.length) {
            description.push(...changedPerms);
        }

        if (positionChanged && description.length === 1) return consoleLogData('Channel Updated', `Guild: ${guild.name} | Position change only - skipped`, 'info');

        // No meaningful change
        if (description.length === 0) {
            return consoleLogData('Channel Updated', `Guild: ${guild.name} | No significant changes`, 'info');
        }

        const embed = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setTitle('Channel Updated')
            .setDescription(description.join('\n'))
            .setFooter({ text: `CID: ${newChannel.id}` })
            .setTimestamp();

        logChannel.send({ embeds: [embed] })
            .then(() => consoleLogData('Channel Updated', `Guild: ${guild.name} | Logged changes in #${newChannel.name}`, 'info'))
            .catch(err => consoleLogData('Channel Updated', `Guild: ${guild.name} | Failed to send log: ${err.message}`, 'error'));
    }
};

/**
 * Formats permission allow/deny fields into readable text.
 */
function formatPermissions(overwrite) {
    const allowed = new PermissionsBitField(overwrite.allow.bitfield).toArray();
    const denied = new PermissionsBitField(overwrite.deny.bitfield).toArray();
    const parts = [];

    if (allowed.length > 0) parts.push(`<a:OVX_Yes:1115593935746781185> **Allowed:** \`${allowed.join(', ')}\``);
    if (denied.length > 0) parts.push(`<a:OVX_No:1115593604073791488>  **Denied:** \`${denied.join(', ')}\``);

    return parts.join('\n');
}

/**
 * Compares permission overwrites and returns a string of differences.
 */
function comparePermissionDiff(oldPerm, newPerm) {
    const changes = [];
    const allPerms = Object.keys(PermissionsBitField.Flags);

    for (const perm of allPerms) {
        const oldAllowed = oldPerm.allow.has(perm);
        const oldDenied = oldPerm.deny.has(perm);
        const newAllowed = newPerm.allow.has(perm);
        const newDenied = newPerm.deny.has(perm);

        if (oldAllowed !== newAllowed || oldDenied !== newDenied) {
            if (newAllowed) {
                changes.push(`<a:OVX_Yes:1115593935746781185> \`${perm}\``);
            } else if (newDenied) {
                changes.push(`<a:OVX_No:1115593604073791488>  \`${perm}\``);
            } else {
                changes.push(`× \`${perm}\``); // removed
            }
        }
    }

    return changes.length ? changes.join('\n') : null;
}
