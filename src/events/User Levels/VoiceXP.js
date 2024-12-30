const { EmbedBuilder, Events, PermissionFlagsBits, VoiceState } = require('discord.js');
const { permissionCheck } = require('../../utils/Checks.js');
const { LevelNotifications } = require('../../models/GuildSetups.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const { addUserVoiceXP } = require('../../utils/Levels/XP-Database.js');
const { DeveloperIDs, DeveloperMode } = process.env;
const inVoiceChannelMembers = new Map();

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,
    nickname: 'Voice XP',

    /**
     * @param {VoiceState} oldState
     * @param {VoiceState} newState
     */
    async execute(oldState, newState) {
        const { guild, member, client } = newState;

        // Exit if the member is a bot, outside a guild, or in developer mode
        if (!guild || member.user.bot || DeveloperMode === 'true') return;

        // Fetch guild level notifications
        const guildLevelNotifications = await LevelNotifications.findOne({ guildId: guild.id });
        if (!guildLevelNotifications || !guildLevelNotifications.enabled) return;

        // User joins a voice channel
        if (!oldState.channel && newState.channel) {
            if (isBlacklisted(member, newState.channel, guildLevelNotifications)) return;

            inVoiceChannelMembers.set(member.user.id, {
                channel: newState.channel,
                time: Date.now(),
            });
            cleanConsoleLogData('Voice Log', `Joined Voice Channel ${newState.channel.name}`, 'debug');
            return;
        }

        // User switches voice channels
        if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            if (isBlacklisted(member, newState.channel, guildLevelNotifications)) {
                inVoiceChannelMembers.delete(member.user.id);
                return;
            }

            const joinData = inVoiceChannelMembers.get(member.user.id);
            const timeInChannel = Date.now() - joinData.time;
            const timeInChannelMinutes = Math.floor(timeInChannel / 1000 / 60);

            if (timeInChannelMinutes < 3 && !DeveloperIDs.includes(member.user.id)) {
                cleanConsoleLogData('Voice Log', `User @${member.user.username} left voice channel ${oldState.channel.name} before 3 minutes`, 'debug');
                inVoiceChannelMembers.delete(member.user.id);
                return;
            }

            const targetChannel = guild.channels.cache.get(guildLevelNotifications.channelId);
            const DisabledFeaturesChannel = guild.channels.cache.get(guildLevelNotifications.disabledChannelId);
            if (!targetChannel) {
                await disableLevels(guildLevelNotifications, guild, DisabledFeaturesChannel, 'Channel not found');
                return;
            }

            // Check bot permissions
            const requiredPermissions = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageRoles];
            const [hasPermissions, missingPermissions] = permissionCheck(targetChannel, requiredPermissions, client);

            if (!hasPermissions) {
                await disableLevels(guildLevelNotifications, guild, DisabledFeaturesChannel, `Missing Permissions: \`${missingPermissions}\``);
                return;
            }

            await addUserVoiceXP(member, targetChannel, guildLevelNotifications.levelRewards, timeInChannelMinutes);

            inVoiceChannelMembers.set(member.user.id, {
                channel: newState.channel,
                time: Date.now(),
            });

            cleanConsoleLogData('Voice Log', `Switched Voice Channel ${oldState.channel.name} to ${newState.channel.name}`, 'debug');
        }

        // User leaves a voice channel
        if (oldState.channel && !newState.channel) {
            if (!inVoiceChannelMembers.has(member.user.id)) return;
            cleanConsoleLogData('Voice Log', `Left Voice Channel ${oldState?.channel?.name || 'Channel was deleted'}`, 'debug');

            const joinData = inVoiceChannelMembers.get(member.user.id);
            const timeInChannel = Date.now() - joinData.time;
            const timeInChannelMinutes = Math.floor(timeInChannel / 1000 / 60);

            if (timeInChannelMinutes < 3 && !DeveloperIDs.includes(member.user.id)) {
                cleanConsoleLogData('Voice Log', `User @${member.user.username} left voice channel ${oldState.channel.name} before 3 minutes`, 'debug');
                inVoiceChannelMembers.delete(member.user.id);
                return;
            }

            const targetChannel = guild.channels.cache.get(guildLevelNotifications.channelId);
            const DisabledFeaturesChannel = guild.channels.cache.get(guildLevelNotifications.disabledChannelId);
            if (!targetChannel) {
                await disableLevels(guildLevelNotifications, guild, DisabledFeaturesChannel, 'Channel not found');
                return;
            }

            // Check bot permissions
            const requiredPermissions = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageRoles];
            const [hasPermissions, missingPermissions] = permissionCheck(targetChannel, requiredPermissions, client);

            if (!hasPermissions) {
                await disableLevels(guildLevelNotifications, guild, DisabledFeaturesChannel, `Missing Permissions: \`${missingPermissions}\``);
                return;
            }

            await addUserVoiceXP(member, targetChannel, guildLevelNotifications.levelRewards, timeInChannelMinutes);
        }
    }
};

/**
 * Disable levels and notify the disabled features channel
 * @param {Object} guildLevelNotifications
 * @param {Guild} guild
 * @param {TextChannel} DisabledFeaturesChannel
 * @param {String} reason
 */
async function disableLevels(guildLevelNotifications, guild, DisabledFeaturesChannel, reason) {
    await guildLevelNotifications.updateOne({ enabled: false });

    if (DisabledFeaturesChannel) {
        const Embed = new EmbedBuilder()
            .setColor('Red')
            .setDescription(`${guild.name} | Levels | Levels disabled | ${reason}`);
        await DisabledFeaturesChannel.send({ embeds: [Embed] });
    }
}

/**
 * Check if the member or channel is blacklisted
 * @param {GuildMember} member
 * @param {VoiceChannel} voiceChannel
 * @param {Object} guildLevelNotifications
 * @returns {Boolean}
 */
function isBlacklisted(member, voiceChannel, guildLevelNotifications) {
    const hasBlacklistedRole = guildLevelNotifications.blacklisted.roles.some(roleId => member.roles.cache.has(roleId));
    const isBlacklistedChannel = guildLevelNotifications.blacklisted.channels.includes(voiceChannel.id);

    if (hasBlacklistedRole) {
        cleanConsoleLogData('Voice Log', `User has blacklisted role`, 'warn');
        return true;
    }

    if (isBlacklistedChannel) {
        cleanConsoleLogData('Voice Log', `User has blacklisted channel`, 'warn');
        return true;
    }

    return false;
}