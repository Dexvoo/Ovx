import { PermissionFlagsBits } from 'discord.js';
import Guild_Level_Cache from '../cache/guildLevels.cache.js';

/**
 * @typedef {import('../../../core/extendedClient.js').default} Client
 *
 * Performs all preliminary checks for granting XP.
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').GuildBasedChannel} channelLevel - The channel where the event occurred.
 * @returns {Promise<{ guildConfig: import('../models/guildLevels.js').GuildLevelsType } | null>} null if XP should not be granted
 */
export async function ValidateXP(member, channelLevel) {
    const { guild, client } = member;

    const guildConfig = await Guild_Level_Cache.get(guild.id);
    if (!guildConfig?.enabled || !guildConfig.channelId) {
        if (guildConfig && !guildConfig.enabled) {
            client.utils.LogData('XP Pre-Check', `Guild: ${guild.name} | Levels disabled.`, 'debug');
        }
        return null;
    }

    // Check the configured level-up channel, not the channel the activity happened in
    const levelUpChannel = guild.channels.cache.get(guildConfig.channelId);
    const botPermissions = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
    ];
    const [hasPerms] = levelUpChannel ? client.utils.PermissionCheck(levelUpChannel, botPermissions, client) : [false];
    if (!hasPerms) {
        client.utils.LogData(
            'XP Pre-Check',
            `Guild: ${guild.name} | Level-up channel missing or lacking permissions, disabling`,
            'error'
        );
        await Guild_Level_Cache.setType(guild.id, 'enabled', false);
        return null;
    }

    if (isBlacklisted(member, channelLevel, guildConfig)) return null;

    return { guildConfig };
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').GuildBasedChannel} channel
 * @param {import('../models/guildLevels.js').GuildLevelsType} config
 * @returns {boolean}
 */
function isBlacklisted(member, channel, config) {
    const { client } = channel;
    if (!config.blacklisted) return false;

    const hasBlacklistedRole = config.blacklisted.roleIds?.some((roleId) => member.roles.cache.has(roleId));
    const isBlacklistedChannel = config.blacklisted.channelIds?.includes(channel.id);

    if (hasBlacklistedRole) {
        client.utils.LogData(
            'XP Blacklist',
            `Guild: ${member.guild.name} | User: @${member.user.username} | Has blacklisted role`,
            'debug'
        );
        return true;
    }

    if (isBlacklistedChannel) {
        client.utils.LogData(
            'XP Blacklist',
            `Guild: ${member.guild.name} | Channel: #${channel.name} | Is a blacklisted channel`,
            'debug'
        );
        return true;
    }

    return false;
}
