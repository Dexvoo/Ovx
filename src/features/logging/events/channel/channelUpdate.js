import { Events, AuditLogEvent, ChannelType, PermissionsBitField } from 'discord.js';
import { getLogChannel, findAuditLogExecutor } from '../../utils/logChannel.js';

export const name = Events.ChannelUpdate;
export const once = false;
export const description = 'Guild Channel Update Logs';

/**
 * @typedef {import('../../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').GuildChannel & { client: Client }} oldChannel
 * @param {import('discord.js').GuildChannel & { client: Client }} newChannel
 */

export async function execute(oldChannel, newChannel) {
    const { client, guild } = newChannel;

    if (!guild) return;

    const logChannel = await getLogChannel(guild, 'channel', { sourceChannelId: newChannel.id });
    if (!logChannel) return;

    const executor = await findAuditLogExecutor(
        guild,
        AuditLogEvent.ChannelUpdate,
        (entry) => entry.targetId === newChannel.id && Date.now() - entry.createdTimestamp < 5000
    );

    let description = '';
    if (oldChannel.name !== newChannel.name) {
        description += `**Name:** \`${oldChannel.name}\` → \`${newChannel.name}\`\n`;
    }

    if (oldChannel.type !== newChannel.type) {
        description += `**Type:** \`${ChannelType[oldChannel.type] || 'Unknown'}\` → \`${ChannelType[newChannel.type] || 'Unknown'}\`\n`;
    }

    // These only exist on some channel types (e.g. topic on text channels, bitrate on voice)
    const oldTopic = channelProp(oldChannel, 'topic');
    const newTopic = channelProp(newChannel, 'topic');
    if (oldTopic !== newTopic) {
        const oldText = oldTopic ? client.utils.Truncate(oldTopic, 100) : 'None';
        const newText = newTopic ? client.utils.Truncate(newTopic, 100) : 'None';
        description += `**Topic:** \`${oldText}\` → \`${newText}\`\n`;
    }

    const oldNsfw = channelProp(oldChannel, 'nsfw');
    const newNsfw = channelProp(newChannel, 'nsfw');
    if (oldNsfw !== newNsfw) {
        description += `**NSFW:** \`${oldNsfw ? 'Yes' : 'No'}\` → \`${newNsfw ? 'Yes' : 'No'}\`\n`;
    }

    const oldSlowmode = channelProp(oldChannel, 'rateLimitPerUser');
    const newSlowmode = channelProp(newChannel, 'rateLimitPerUser');
    if (oldSlowmode !== newSlowmode) {
        description += `**Slowmode:** \`${oldSlowmode || 0}s\` → \`${newSlowmode || 0}s\`\n`;
    }

    const oldBitrate = channelProp(oldChannel, 'bitrate');
    const newBitrate = channelProp(newChannel, 'bitrate');
    if (oldBitrate !== newBitrate) {
        description += `**Bitrate:** \`${(oldBitrate || 0) / 1000}kbps\` → \`${(newBitrate || 0) / 1000}kbps\`\n`;
    }

    const oldUserLimit = channelProp(oldChannel, 'userLimit');
    const newUserLimit = channelProp(newChannel, 'userLimit');
    if (oldUserLimit !== newUserLimit) {
        description += `**User Limit:** \`${oldUserLimit || 'Unlimited'}\` → \`${newUserLimit || 'Unlimited'}\`\n`;
    }

    if (oldChannel.parentId !== newChannel.parentId) {
        const oldParent = oldChannel.parentId ? `<#${oldChannel.parentId}>` : 'None';
        const newParent = newChannel.parentId ? `<#${newChannel.parentId}>` : 'None';
        description += `**Category:** ${oldParent} → ${newParent}\n`;
    }

    const oldPerms = oldChannel.permissionOverwrites.cache;
    const newPerms = newChannel.permissionOverwrites.cache;
    let permChanges = '';

    newPerms.forEach((perm, id) => {
        const old = oldPerms.get(id);
        const target = perm.type === 0 ? `<@&${id}>` : `<@${id}>`; // 0 is Role, 1 is Member

        if (!old) {
            permChanges += `**Added for ${target}:**\n${formatPermissions(perm)}\n`;
            return;
        }

        const diff = comparePermissionDiff(old, perm);
        if (diff) {
            permChanges += `**Updated for ${target}:**\n${diff}\n`;
        }
    });

    oldPerms.forEach((perm, id) => {
        if (!newPerms.has(id)) {
            const target = perm.type === 0 ? `<@&${id}>` : `<@${id}>`;
            permChanges += `**Removed for ${target}:**\n${formatPermissions(perm)}\n`;
        }
    });

    if (permChanges.length > 0) {
        // Use Truncate just in case a massive permission overhaul exceeds embed field limits
        description += `**Permission Overwrites:**\n${client.utils.Truncate(permChanges, 2000)}\n`;
    }

    if (description === '') return;

    const footerText = `CID: ${newChannel.id}`;
    const title = client.utils.Translate('logs.channel.update', guild.preferredLocale);

    return client.utils.Embed(logChannel, 'White', title, description, {
        timestamp: true,
        footer: { text: footerText },
        author: executor,
    });
}

/**
 * Reads a property that only some channel types have.
 * @param {import('discord.js').GuildChannel} channel
 * @param {'topic' | 'nsfw' | 'rateLimitPerUser' | 'bitrate' | 'userLimit'} key
 * @returns {any} The value, or undefined if this channel type doesn't have it
 */
function channelProp(channel, key) {
    return key in channel ? channel[key] : undefined;
}

/**
 * Formats permission allow/deny fields into readable text.
 * @param {import('discord.js').PermissionOverwrites} overwrite
 */
function formatPermissions(overwrite) {
    const allowed = new PermissionsBitField(overwrite.allow.bitfield).toArray();
    const denied = new PermissionsBitField(overwrite.deny.bitfield).toArray();
    const parts = [];

    if (allowed.length > 0) parts.push(`✅ **Allowed:** \`${allowed.join(', ')}\``);
    if (denied.length > 0) parts.push(`❌ **Denied:** \`${denied.join(', ')}\``);

    return parts.join('\n');
}

/**
 * Compares permission overwrites and returns a string of differences.
 * @param {import('discord.js').PermissionOverwrites} oldPerm
 * @param {import('discord.js').PermissionOverwrites} newPerm
 */
function comparePermissionDiff(oldPerm, newPerm) {
    const changes = [];
    const allPerms = /** @type {import('discord.js').PermissionsString[]} */ (Object.keys(PermissionsBitField.Flags));

    for (const perm of allPerms) {
        const oldAllowed = oldPerm.allow.has(perm);
        const oldDenied = oldPerm.deny.has(perm);
        const newAllowed = newPerm.allow.has(perm);
        const newDenied = newPerm.deny.has(perm);

        if (oldAllowed !== newAllowed || oldDenied !== newDenied) {
            if (newAllowed) {
                changes.push(`✅ \`${perm}\``);
            } else if (newDenied) {
                changes.push(`❌ \`${perm}\``);
            } else {
                changes.push(`⬜ \`${perm}\` (Reset)`);
            }
        }
    }

    return changes.length ? changes.join('\n') : null;
}
