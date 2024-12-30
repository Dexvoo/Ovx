const { EmbedBuilder, Events, PermissionFlagsBits } = require('discord.js');
const { permissionCheck } = require('../../utils/Checks.js');
const { LevelNotifications } = require('../../models/GuildSetups.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const { addUserMessageXP } = require('../../utils/Levels/XP-Database.js');
const cooldowns = new Set();
const { DeveloperIDs, DisabledFeaturesChannelID, DevGuildID, DeveloperMode } = process.env;

module.exports = {
    name: Events.MessageCreate,
    once: false,
    nickname: 'Message XP',

    /**
     * @param {Message} message
     * @returns
     * @description Message XP
     */
    async execute(message) {
        const { client, guild, author, member, channel: messageChannel } = message;

        // Exit if message is from a bot, outside a guild, or in developer mode
        if (!guild || author.bot || DeveloperMode === 'true') return;

        if(message.content.length < 5) return addCooldown(author.id);

        // Check if user is on cooldown
        if (cooldowns.has(author.id)) return;

        try {
            const guildLevelNotifications = await LevelNotifications.findOne({ guildId: guild.id });
            if (!guildLevelNotifications || !guildLevelNotifications.enabled) return;

            const levelChannel = guild.channels.cache.get(guildLevelNotifications.channelId);
            const DisabledFeaturesChannel = client.guilds.cache.get(DevGuildID)?.channels.cache.get(DisabledFeaturesChannelID);

            if (!levelChannel) {
                await disableLevels(guildLevelNotifications, guild, DisabledFeaturesChannel, 'Channel not found');
                return;
            }

            if (isBlacklisted(member, messageChannel, guildLevelNotifications)) return;

            // Check bot permissions
            const requiredPermissions = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageRoles];
            const [hasPermissions, missingPermissions] = permissionCheck(levelChannel, requiredPermissions, client);

            if (!hasPermissions) {
                await disableLevels(guildLevelNotifications, guild, DisabledFeaturesChannel, `Missing Permissions: \`${missingPermissions}\``);
                return;
            }

            await addUserMessageXP(member, levelChannel, guildLevelNotifications.levelRewards);

            if (!DeveloperIDs.includes(author.id)) {
                addCooldown(author.id);
            }

        } catch (error) {
            cleanConsoleLogData('Message XP', `Error: ${error.message}`, 'error');
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
 * @param {TextChannel} messageChannel
 * @param {Object} guildLevelNotifications
 * @returns {Boolean}
 */
function isBlacklisted(member, messageChannel, guildLevelNotifications) {
    const hasBlacklistedRole = guildLevelNotifications.blacklisted.roles.some(roleId => member.roles.cache.has(roleId));
    const isBlacklistedChannel = guildLevelNotifications.blacklisted.channels.includes(messageChannel.id);

    if (hasBlacklistedRole) {
        cleanConsoleLogData('Message XP', `User has blacklisted role`, 'warn');
        addCooldown(member.id);
        return true;
    }

    if (isBlacklistedChannel) {
        cleanConsoleLogData('Message XP', `User has blacklisted channel`, 'warn');
        addCooldown(member.id);
        return true;
    }

    return false;
}

/**
 * Add a cooldown for the user
 * @param {String} userId
 */
function addCooldown(userId) {
    cooldowns.add(userId);
    setTimeout(() => cooldowns.delete(userId), 60000);
}