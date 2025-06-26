const { Events, EmbedBuilder, Colors, Message, PermissionFlagsBits, ChannelType, GuildChannel, GuildMember, VoiceState } = require('discord.js');
const LevelsConfigCache = require('../../cache/Levels.js');
const { CooldownManager } = require('../../utils/Classes/cooldowns.js');
const { addUserVoiceXP } = require('../../utils/Functions/Levels/XP-Database.js');

const inVoiceChannelMembers = new Map();

const cooldowns = new CooldownManager();

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,
    nickname: 'Voice XP | Levels',


    /**
     * @param {import('../../types.js').VoiceUtils} oldState
     * @param {import('../../types.js').VoiceUtils} newState
     */

    async execute(oldState, newState) {
        const { client, guild, member } = newState;

        if(member.user.bot || !guild) return;
        if(cooldowns.has('Voice', member.id)) return client.utils.LogData('Voice Cooldown', `Guild: ${guild.name} | User: @${member.user.username} | Ends: ${(cooldowns.getRemaining('Voice', member.id).toLocaleString())} `, 'default');
        
        const guildConfigData = await LevelsConfigCache.get(guild.id);
        if(!guildConfigData.enabled || guildConfigData.channelId === null) return client.utils.LogData('Voice XP', `Guild: ${guild.name} | Disabled`, 'warning');

        const levelChannel = guild.channels.cache.get(guildConfigData.channelId);
        if(!levelChannel) return client.utils.LogData('Voice XP', `Guild: ${guild.name} | level Channel not found, disabling levels`, 'error');



        if(!oldState.channel && newState.channel) {
            if(isBlacklisted(member, levelChannel, guildConfigData)) return;

            inVoiceChannelMembers.set(member.id, {
                channel: newState.channel,
                time: Date.now(),
            });

            client.utils.LogData('Voice XP', `Guild: ${guild.name} | User: @${member.user.username} joined #${newState.channel.name}`, 'debug');
            return;            
        }

        if(oldState.channel && newState.channel && oldState.channelId !== newState.channelId) {
            if(isBlacklisted(member, levelChannel, guildConfigData)) return;

            const voiceData = inVoiceChannelMembers.get(member.id);
            if (!voiceData) return;

            const timeInChannel = ((Date.now() - voiceData.time) / 1000 / 60).toFixed(1);
            const parsedTime = parseFloat(timeInChannel);

            if(timeInChannel < 3) {
                client.utils.LogData('Voice XP', `Guild: ${guild.name} | Left Before 3 mins (${timeInChannel})`, 'debug');
                inVoiceChannelMembers.delete(member.id)
                return;
            }


            const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
            const [hasPermissions, missingPermissions] = client.utils.PermCheck(levelChannel, botPermissions, client);
            if(!hasPermissions) {
                LevelsConfigCache.setType(guild.id, 'enabled', false);
                return client.utils.LogData('Levels', `Guild: ${guild.name} | Bot missing permissions in level channel, disabling levels`, 'error');
            }


            await addUserVoiceXP(member, levelChannel, guildConfigData, parsedTime);


            inVoiceChannelMembers.set(member.id, {
                channel: newState.channel,
                time: Date.now(),
            });

            client.utils.LogData('Voice XP', `Guild: ${guild.name} | User: @${member.user.username} switched from #${oldState.channel.name} to #${newState.channel.name}`, 'debug');
        }

        if (oldState.channel && !newState.channel) {
            const voiceData = inVoiceChannelMembers.get(member.id);
            if (!voiceData) return;
        
            const timeInChannel = (Date.now() - voiceData.time) / 1000 / 60;
            if (timeInChannel < 3) return client.utils.LogData('Voice XP', `Guild: ${guild.name} | Left Before 3 mins (${timeInChannel.toFixed(1)} mins)`, 'debug');
        
            const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
            const [hasPermissions, missingPermissions] = client.utils.PermCheck(levelChannel, botPermissions, client);
            if (!hasPermissions) {
                LevelsConfigCache.setType(guild.id, 'enabled', false);
                return client.utils.LogData('Levels', `Guild: ${guild.name} | Bot missing permissions in level channel, disabling levels`, 'error');
            }
        
            await addUserVoiceXP(member, levelChannel, guildConfigData, timeInChannel);
            inVoiceChannelMembers.delete(member.id);
        
            client.utils.LogData('Voice XP', `Guild: ${guild.name} | User: @${member.user.username} | Left VC after ${timeInChannel.toFixed(1)} mins`, 'info');
        }

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
    if (!config.blacklisted || !Array.isArray(config.blacklisted.roleIds) || !Array.isArray(config.blacklisted.channelIds)) return false;
    
    const hasBlacklistedRole = config.blacklisted.roleIds.some(roleId => member.roles.cache.has(roleId));
    const isBlacklistedChannel = config.blacklisted.channelIds.includes(channel.id);

    if(hasBlacklistedRole) {
        client.utils.LogData('Voice XP', `Guild: ${member.guild.name} | User: @${member.user.username} | Has blacklisted role`, 'warning');
        cooldowns.add('Voice', member.id, config.voiceCooldown || 180);
        return true;
    }

    if(isBlacklistedChannel) {
        client.utils.LogData('Voice XP', `Guild: ${member.guild.name} | Channel: #${channel.name} | Is a blacklisted channel`, 'warning');
        cooldowns.add('Voice', member.id, config.voiceCooldown || 180);
        return true;
    }

    return false;
};