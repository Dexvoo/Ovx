const { GuildMember, GuildChannel, VoiceBasedChannel, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { VoiceXP, MessageXP, LevelForExp, ExpForLevel } = require('./XPMathematics');
const { UserLevels } = require('../../models/Levels');
const { LevelNotifications } = require('../../models/GuildSetups');
const { UserLevelLoggingChannelID, PublicClientID, TopggAPIKey } = process.env;



/**
 * @param {GuildMember} member - GuildMember
 * @param {GuildChannel | VoiceBasedChannel } channel - Channel
 * @param {GuildRewards} guildRewards - GuildRewards
 * @param {number} timeInChannel - Time in channel in minutes
 */

async function addUserVoiceXP(member, channel, guildRewards, timeInChannel) {
    if (!member) throw new Error('No member provided');
    if (!channel) throw new Error('No channel provided');

    const { guild, user } = member;

    let levelData = await UserLevels.findOne({ userId: user.id, guildId: guild.id });
    let newLevel, xpLeftover, newVoiceMinutes, oldTotalXP = 0;

    const hasVoted = await fetch(`https://top.gg/api/bots/${PublicClientID}/check?userId=${user.id}`, {
        headers: {
            'Authorization': TopggAPIKey
        }}).then(res => res.json()).then(json => json.voted);

    var randomXP = VoiceXP(timeInChannel);
    if (hasVoted) {
        randomXP = randomXP + (Math.floor(randomXP * 0.1));
    }

    if(!levelData) {
        [newLevel, xpLeftover] = LevelForExp(randomXP);
        const newUserXP = new UserLevels({
            userId: user.id,
            guildId: guild.id,
            xp: xpLeftover,
            level: newLevel,
        });
        await newUserXP.save();

        oldTotalXP = 0;

    } else {
        oldTotalXP = ExpForLevel(levelData.level) + levelData.xp;

        const newXP = oldTotalXP + randomXP;
        [newLevel, xpLeftover] = LevelForExp(newXP);
        newVoiceMinutes = levelData.totalVoice + timeInChannel;

        await UserLevels.findOneAndUpdate(
            { userId: user.id, guildId: guild.id },
            { level: newLevel, xp: xpLeftover, totalVoice: newVoiceMinutes },
        );
    }

    for( let i = levelData ? levelData.level : 0; i < newLevel; i++) {
        await userLevelUp(member, channel, i + 1, guildRewards);
    }


}


/**
 * @param {GuildMember} member - GuildMember
 * @param {GuildChannel | VoiceBasedChannel } channel - Channel
 * @param {GuildRewards} guildRewards - GuildRewards
 */
async function addUserMessageXP(member, channel, guildRewards) {
    if (!member) throw new Error('No member provided');
    if (!channel) throw new Error('No channel provided');

    const { guild, user } = member;

    let levelData = await UserLevels.findOne({ userId: user.id, guildId: guild.id });
    let newLevel, xpLeftover, newNumMessages, oldTotalXP = 0;

    const hasVoted = await fetch(`https://top.gg/api/bots/${PublicClientID}/check?userId=${user.id}`, {
        headers: {
            'Authorization': TopggAPIKey
        }}).then(res => res.json()).then(json => json.voted);

    var randomXP = MessageXP()
    if (hasVoted) {
        randomXP = randomXP + (Math.floor(randomXP * 0.1));
    }


    if (!levelData) {
        [newLevel, xpLeftover] = LevelForExp(randomXP);
        const newUserXP = new UserLevels({
            userId: user.id,
            guildId: guild.id,
            xp: xpLeftover,
            level: newLevel,
        });
        await newUserXP.save();

        oldTotalXP = 0;
    } else {
        oldTotalXP = ExpForLevel(levelData.level) + levelData.xp;

        const newXP = oldTotalXP + randomXP;
        [newLevel, xpLeftover] = LevelForExp(newXP);
        newNumMessages = levelData.totalMessages + 1;

        await UserLevels.findOneAndUpdate(
            { userId: user.id, guildId: guild.id },
            { level: newLevel, xp: xpLeftover, totalMessages: newNumMessages },
        );
    }

    for( let i = levelData ? levelData.level : 0; i < newLevel; i++) {
        await userLevelUp(member, channel, i + 1, guildRewards);
    }
}

/**
 * @param {GuildMember} member - GuildMember
 * @param {GuildChannel | VoiceBasedChannel } channel - Channel
 * @param {number} newLevel - New level
 * @param {GuildRewards} guildRewards - GuildRewards
 */
async function userLevelUp(member, channel, newLevel, guildRewards) {
    if (!member) throw new Error('No member provided');
    if (!channel) throw new Error('No channel provided');
    const { guild, user, client } = member;

    let hasReceivedReward = false;
    const AddedRoles = [];

    if (guildRewards.length === 0) {
    } else {

        const memberRoles = member.roles.cache;

        for (const reward of guildRewards) {

            const role = guild.roles.cache.get(reward.roleId) || await guild.roles.fetch(reward.roleId);
            if (!role) {

                await LevelNotifications.findOneAndUpdate(
                    { guildId: guild.id },
                    { $pull: { levelRewards: { roleId: reward.roleId } } },
                );
                continue;
            }

            if (reward.level === newLevel) {

                hasReceivedReward = true;
                console.log(`Reward Role: ${role.name} | ${role}`);
                AddedRoles.push({ role: role, level: reward.level });
            } else if (reward.level < newLevel) {
                
                if (memberRoles.has(reward.roleId)) {
                    continue;
                }

                hasReceivedReward = true;
                console.log(`Reward Role: ${role.name} | ${role}`);
                AddedRoles.push({ role: role, level: reward.level });
            }
        }
    }

    const DevLogEmbed = new EmbedBuilder()
        .setColor('Blurple')
        .setDescription(`User: ${member} | Guild: ${guild.name} | Level: \`${newLevel}\``);
    
    const LevelUpEmbed = new EmbedBuilder()
        .setColor('Blurple')
        .setDescription(`${member} you just gained a level! Current Level: **${newLevel}**!`);

    if (hasReceivedReward) {
        try {
            await member.roles.add(AddedRoles.map(role => role.role))
        } catch (error) {
            console.error(`Error adding roles to user: ${error.message}`);
            
        }

        LevelUpEmbed.addFields(
            { name: 'Reward Roles', value: `${AddedRoles.map(role => role.role).join(', ')}`, inline: true },
        )
        
    } 

    const DeveloperLevelUpChannel = client.channels.cache.get(UserLevelLoggingChannelID);
    if (DeveloperLevelUpChannel) {
        await DeveloperLevelUpChannel.send({ embeds: [DevLogEmbed] });
    }

    await channel.send({ embeds: [LevelUpEmbed ] });
}

module.exports = { addUserMessageXP, addUserVoiceXP };
