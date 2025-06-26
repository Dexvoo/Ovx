const { GuildMember, GuildChannel, VoiceBasedChannel, EmbedBuilder, PermissionFlagsBits, roleMention} = require('discord.js');
const { VoiceXP, MessageXP, LevelForExp, ExpForLevel } = require('./XPMathematics');
const XPCache = require('../../../cache/XP');
const LevelCache = require('../../../cache/Levels')
const { UserLevelLoggingChannelID, PublicClientID, TopggAPIKey } = process.env
const { LevelConfigType} = require('../../../models/GuildSetups');


/**
 * @param {import('../../../types.js').MemberUtils} member
 * @param {import('../../../types.js').ChannelUtils} channel
 * @param {LevelConfigType} levelConfig - Guild Level Config
 */
async function addUserMessageXP(member, channel, levelConfig) {
    if(!member) throw new Error('No member provided');
    if(!channel) throw new Error('No channel provided');
    if(!levelConfig) throw new Error('No guild config provided');

    const { guild, client } = member;
    const userXPData = await XPCache.get(guild.id, member.id)
    let randomXP = MessageXP()
    
    if (await client.utils.HasVotedTGG(member.id)) randomXP = randomXP += (Math.floor(randomXP * 0.1));
    randomXP = Math.floor(randomXP * levelConfig.xpMultiplier)
    let totalXP = userXPData.voiceXP + userXPData.dropsXP + userXPData.messageXP 
    totalXP += randomXP

    const [newLevel, xpLeftover, xpForNextLevel] = LevelForExp(totalXP);
    XPCache.set(guild.id, member.id, { level: newLevel, xp: xpLeftover, totalMessages: userXPData.totalMessages += 1, messageXP: userXPData.messageXP += randomXP, lastMessageAt: new Date()  }); 
    client.utils.LogData('Message XP', `Guild: ${guild.id} | User: @${member.user.username} | XP Earned: ${randomXP} | Level: ${newLevel} | XP: ${xpLeftover} | XPForNext: ${xpForNextLevel}`, 'default')

    for( let i = userXPData.level; i < newLevel; i++) {
        await levelUp(member, channel, i += 1, levelConfig)
    }
};



/**
 * @param {import('../../../types.js').MemberUtils} member
 * @param {import('../../../types.js').ChannelUtils | VoiceBasedChannel} channel
 * @param {LevelConfigType} levelConfig - Guild Level Config
 * @param {Number} timeSpent - time spent in VC
 */
async function addUserVoiceXP(member, channel, levelConfig, timeSpent) {
    if(!member) throw new Error('No member provided');
    if(!channel) throw new Error('No channel provided');
    if(!levelConfig) throw new Error('No guild config provided');
    if(!timeSpent) throw new Error('No timeSpent Provided')

    const { guild, client } = member;
    const userXPData = await XPCache.get(guild.id, member.id)
    
    let randomXP = VoiceXP(timeSpent)
    if (await client.utils.HasVotedTGG(member.id)) randomXP += Math.floor(randomXP * 0.1);
    randomXP = Math.floor(randomXP * levelConfig.xpMultiplier)
    let totalXP = userXPData.voiceXP + userXPData.dropsXP + userXPData.messageXP 
    totalXP += randomXP

    const [newLevel, xpLeftover, xpForNextLevel] = LevelForExp(totalXP);
    XPCache.set(guild.id, member.id, { level: newLevel, xp: xpLeftover, totalVoice: userXPData.totalVoice += Math.floor(timeSpent), voiceXP: userXPData.voiceXP += randomXP, lastVoiceAt: new Date() });
    client.utils.LogData('Voice XP', `Guild: ${guild.id} | User: @${member.user.username} | XP Earned: ${randomXP} | Level: ${newLevel} | XP: ${xpLeftover} | XPForNext: ${xpForNextLevel}`, 'default')

    for( let i = userXPData.level; i < newLevel; i++) {
        await levelUp(member, channel, i += 1, levelConfig)
    }
};


/**
 * @param {GuildMember} member - GuildMember who leveled up
 * @param {GuildChannel} channel - The channel to send the level-up message
 * @param {number} newLevel - New level achieved
 * @param {LevelConfigType} levelConfig - Guild Level Config
 */
async function levelUp(member, channel, newLevel, levelConfig) {
    if (!member) throw new Error('No member provided');
    if (!channel) throw new Error('No channel provided');

    const { guild, user, client } = member;
    const rewards = levelConfig.rewards.sort((a, b) => b.level - a.level) ?? [];
    let addedRoles = [];
    let removedRoles = [];
    
    for(const reward of rewards) {
        const role = guild.roles.cache.get(reward.roleId) || await guild.roles.fetch(reward.roleId).catch(() => { return null});
        if(!role) {
            client.utils.LogData('Level Up', `Guild: ${guild.name} | Missing reward role (ID: ${reward.roleId}) removed from rewards`, 'error');
            LevelCache.setType(guild.id, 'rewards', rewards.filter(r => r.roleId !== reward.roleId));
            continue;
        };

        if(reward.level === newLevel) {
            addedRoles.push({ roleId: role.id, level: reward.level});
        } else if(reward.level < newLevel && levelConfig.removePastRewards) {
            const isGettingNewReward = rewards.some(r => r.level === newLevel);
            if (isGettingNewReward && member.roles.cache.has(reward.roleId)) removedRoles.push({ roleId: role.id, level: reward.level });
        }
    };
    
    if(addedRoles.length > 0) await member.roles.add(addedRoles.map(reward => reward.roleId));

    if(removedRoles.length > 0) await member.roles.remove(removedRoles.map(reward => reward.roleId));


    const levelUpMessageTemplate = levelConfig.levelUpMessage || '{user} leveled up to **{level}**!';
    const levelUpMessage = levelUpMessageTemplate
        .replace('{user}', member.toString())
        .replace('{level}', newLevel.toString());

    const DevEmbed = new EmbedBuilder()
        .setColor('Blurple')
        .setDescription(`User: ${member} | Guild: ${guild.name} | Level: \`${newLevel}\``);

    await client.utils.EmbedDev('userLevel', client, DevEmbed)

    XPCache.set(guild.id, member.id, { lastLevelUpAt: new Date() });

    const levelEmbed = new EmbedBuilder()
        .setColor('Blurple')
        .setDescription(levelUpMessage)
        .addFields(
            ...(addedRoles.length > 0 ? [
                    { name: 'Added Rewards', value: addedRoles.map(reward => roleMention(reward.roleId)).join(', '), inline: true },
                ] : []),
        )

    await channel.send({ embeds: [levelEmbed] }).catch(console.error);

    client.utils.LogData('Level Up', `${user.tag} leveled up to ${newLevel} | Roles Added: ${addedRoles.map(r => r.roleId).join(', ') || 'None'} | Roles Removed: ${removedRoles.map(r => r.roleId).join(', ') || 'None'}`, 'info');
}
module.exports = { addUserMessageXP, addUserVoiceXP };
