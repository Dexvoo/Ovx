const { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent, GuildChannel, PermissionsBitField, ChannelType } = require('discord.js');
const { ChannelLogs } = require('../../../models/GuildSetups');
const { permissionCheck } = require('../../../utils/Checks');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DisabledFeatures } = require('../../../utils/Embeds');
const { DeveloperMode } = process.env;

module.exports = {
    name: Events.ChannelUpdate,
    once: false,
    nickname: 'Channel Update Logs',

    /**
     * @param {GuildChannel} oldChannel
     * @param {GuildChannel} newChannel
     */
    async execute(oldChannel, newChannel) {
        const { client, guild } = newChannel;

        if (!guild || DeveloperMode === 'true') return;

        const guildChannelLogs = await ChannelLogs.findOne({ guildId: guild.id });

        if (!guildChannelLogs || !guildChannelLogs.channelId || !guildChannelLogs.enabled) return cleanConsoleLogData('Channel Updated', `Guild: ${guild.name} | Disabled`, 'warning');

        const targetChannel = guild.channels.cache.get(guildChannelLogs.channelId);

        if (!targetChannel) {
            guildChannelLogs.enabled = false;
            await guildChannelLogs.save().catch(() => { });

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if (!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Channel Logs', `Channel not found`);
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(targetChannel, botPermissions, client);

        if (!hasPermission) {
            guildChannelLogs.enabled = false;
            await guildChannelLogs.save().catch(() => { });

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if (!guildOwner) return;

            return DisabledFeatures(client, guildOwner, 'Channel Logs', `Missing Permissions: \`${missingPermissions}\``);
        }

        const fetchedLogs = await guild.fetchAuditLogs(
            { limit: 1, type: AuditLogEvent.ChannelUpdate }
        ).catch(() => { return false });

        const updateLog = fetchedLogs?.entries?.first();
        let executor = updateLog ? updateLog.executor : null;

        if (!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) executor = 'Bot Missing Permission: `ViewAuditLog` ';

        let description = [];

        if (oldChannel.name !== newChannel.name) {
            description.push(`Name: #${oldChannel.name} -> #${newChannel.name}`);
            sendEmbed(targetChannel, description, executor, 'Name');
            description = [];
        }

        if (oldChannel.type !== newChannel.type) {
            description.push(`Type: ${oldChannel.type} -> ${newChannel.type}`);
            sendEmbed(targetChannel, description, executor, 'Type');
            description = [];
        }

        if (oldChannel.topic !== newChannel.topic) {
            description.push(`Old Topic: \n-# ${oldChannel.topic || 'None Set'}\nNew Topic: \n-# ${newChannel.topic || 'None Set'}`);
            sendEmbed(targetChannel, description, executor, 'Topic');
            description = [];
        }

        if (oldChannel.nsfw !== newChannel.nsfw) {
            description.push(`NSFW: ${oldChannel.nsfw} -> ${newChannel.nsfw}`);
            sendEmbed(targetChannel, description, executor, 'NSFW');
            description = [];
        }

        if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
            description.push(`Rate Limit: ${oldChannel.rateLimitPerUser} -> ${newChannel.rateLimitPerUser}`);
            sendEmbed(targetChannel, description, executor, 'Rate Limit');
            description = [];
        }

        // Permission Changes
        const oldPerms = oldChannel.permissionOverwrites.cache;
        const newPerms = newChannel.permissionOverwrites.cache;

        // Compare permission overwrites for each role/user
        newPerms.forEach((newPerm, id) => {
            const oldPerm = oldPerms.get(id);

            // If the permission did not exist before, it's a new addition
            if (!oldPerm) {
                logChangedPermissions(newPerm, true, targetChannel, executor);
                return;
            }

            // Compare the specific permissions between old and new states
            comparePermissions(oldPerm, newPerm, targetChannel, executor);
        });

        // Check for removed permissions
        oldPerms.forEach((oldPerm, id) => {
            if (!newPerms.has(id)) {
                logChangedPermissions(oldPerm, false, targetChannel, executor);
            }
        });
    }
};

// Function to compare permissions and send embed with only changes
function comparePermissions(oldPerm, newPerm, channel, executor) {
    const allPermissions = Object.keys(PermissionsBitField.Flags); // All possible permission names
    const description = [];
    const type = newPerm.type === 0 ? 'Role' : 'Member';
    const roleOrUser = newPerm.type === 0 ? `<@&${newPerm.id}>` : `<@${newPerm.id}>`
    description.push(`Channel: ${channel}`);
    description.push(`${type}: ${roleOrUser}`);
    const addedPerms = []
    const removedPerms = []
    const deniedPerms = []

    allPermissions.forEach(perm => {
        const oldHasPerm = oldPerm.allow.has(PermissionsBitField.Flags[perm]) || oldPerm.deny.has(PermissionsBitField.Flags[perm]);
        const newHasPerm = newPerm.allow.has(PermissionsBitField.Flags[perm]) || newPerm.deny.has(PermissionsBitField.Flags[perm]);

        // If there was no change for this permission, skip it
        if (oldHasPerm === newHasPerm) return;

        // Check whether the permission was allowed/denied or removed and add to description
        if (newPerm.allow.has(PermissionsBitField.Flags[perm])) {
            addedPerms.push(`${perm}`);
        } else if (newPerm.deny.has(PermissionsBitField.Flags[perm])) {
            deniedPerms.push(`${perm}`);
        } else {
            removedPerms.push(`${perm}`);
        }

        
    });

    if (addedPerms.length > 0) {
        description.push(`**Added Permissions:** \`${addedPerms.join(', ')}\``);
    }

    if (deniedPerms.length > 0) {
        description.push(`**Denied Permissions:** \`${deniedPerms.join(', ')}\``);
    }

    if (removedPerms.length > 0) {
        description.push(`**Removed Permissions:** \`${removedPerms.join(', ')}\``);
    }

    if (description.length > 2) {
        sendPermsEmbed(channel, description, executor, 'Permissions');
    }
}

// Function to log all permissions when added or removed entirely
function logChangedPermissions(overwrite, isAdded, channel, executor) {
    const type = overwrite.type === 0 ? 'Role' : 'Member';
    const action = isAdded ? 'added' : 'removed';
    const roleOrUser = overwrite.type === 0 ? `<@&${overwrite.id}>` : `<@${overwrite.id}>`
    const description = [`Channel: ${channel}`, `${type}: ${roleOrUser}`, `Permissions were ${action}`]

    const allowedPermissions = new PermissionsBitField(overwrite.allow.bitfield).toArray();
    const deniedPermissions = new PermissionsBitField(overwrite.deny.bitfield).toArray();

    if (allowedPermissions.length > 0) {
        description.push(`**Allowed Permissions:** ${allowedPermissions.join(', ')}`);
    }
    if (deniedPermissions.length > 0) {
        description.push(`**Denied Permissions:** ${deniedPermissions.join(', ')}`);
    }
    sendEmbed(channel, description, executor, 'Permissions');
}

// Function to send embed
function sendEmbed(channel, description, executor, type) {
    if (executor) description.push(`**Updated by:** ${executor}`);

    const embed = new EmbedBuilder()
        .setTitle(`Channel ${type} Updated`)
        .setColor('Orange')
        .setDescription(description.join('\n'));
    
    return channel.send({ embeds: [embed] }).catch(() => { });
}