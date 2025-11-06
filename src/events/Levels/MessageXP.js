const { Events, EmbedBuilder, Colors, Message, PermissionFlagsBits, ChannelType, GuildChannel, GuildMember } = require('discord.js');
const LevelsConfigCache = require('../../cache/Levels.js');
const { CooldownManager } = require('../../utils/Classes/cooldowns.js');
const { addUserMessageXP } = require('../../utils/Functions/Levels/XP-Database.js');

const cooldowns = new CooldownManager();

module.exports = {
    name: Events.MessageCreate,
    once: false,
    nickname: 'Message XP | Levels',


    /**
     * @param {import('../../types.js').MessageUtils} message
     */

    async execute(message) {
        const { client, guild, channel, content, author, member } = message;

        if(author.bot || !guild || channel.type !== ChannelType.GuildText) return;
        if(cooldowns.has('Message', member.id)) return client.utils.LogData('Message Cooldown', `Guild: ${guild.name} | User: @${member.user.username} | Ends: ${(cooldowns.getRemaining('Message', member.id).toLocaleString())} `, 'default');
        if(content.length <= 4) return;

        
        const guildConfigData = await LevelsConfigCache.get(guild.id);
        if(!guildConfigData.enabled || guildConfigData.channelId === null) return client.utils.LogData('Message XP', `Guild: ${guild.name} | Disabled`, 'warning');

        const levelChannel = guild.channels.cache.get(guildConfigData.channelId);
        if(!levelChannel) return client.utils.LogData('Message XP', `Guild: ${guild.name} | level Channel not found, disabling levels`, 'error');

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermissions, missingPermissions] = client.utils.PermCheck(levelChannel, botPermissions, client);
        if(!hasPermissions) {
            LevelsConfigCache.setType(guild.id, 'enabled', false);
            return client.utils.LogData('Levels', `Guild: ${guild.name} | Bot missing permissions in level channel, disabling levels`, 'error');
        }
        
        if(isBlacklisted(member, channel, guildConfigData)) return;

        // The cooldown is now applied *after* XP is granted in the addUserMessageXP function.
        await addUserMessageXP(member, levelChannel, guildConfigData);

    }
};


/**
 * Check if the member or channel is blacklisted
 * @param {import('../../types.js').MemberUtils} member
 * @param {import('../../types.js').ChannelUtils} channel
 * @param {import('../../models/GuildSetups.js').LevelConfigType} config
 * @returns {Boolean}
 */
function isBlacklisted(member, channel, config) {
    const { client } = channel;
    if (!config.blacklisted) return false;

    const hasBlacklistedRole = config.blacklisted.roleIds.some(roleId => member.roles.cache.has(roleId));
    const isBlacklistedChannel = config.blacklisted.channelIds.includes(channel.id);
    
    if(hasBlacklistedRole) {
        client.utils.LogData('Message XP', `Guild: ${member.guild.name} | User: @${member.user.username} | Has blacklisted role`, 'warning');
        return true;
    }

    if(isBlacklistedChannel) {
        client.utils.LogData('Message XP', `Guild: ${member.guild.name} | Channel: #${channel.name} | Is a blacklisted channel`, 'warning');
        return true;
    }

    return false;
}

/**
 * Add a cooldown for the user
 * @param {String} userId
 */
function addCooldown(userId, cooldownTime) {
    cooldowns.add('Message', userId, cooldownTime)
};