const { Colors, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups')
const Cache_Levels = require('../../../cache/Levels');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function LevelBlacklist(interaction, context) {
    const { client, options, guildId, memberPermissions } = interaction;

    // 
    const role = options.getRole('role') || null;
    const channel = options.getChannel('channel') || null;

    if(role === null && channel === null) return client.utils.Embed(interaction, Colors.Blurple, 'Levels Settings', `Please provide a valid channel/role to blacklist gaining xp`);

    if(role !== null) {

        console.log(context.LevelConfigData.blacklisted)

        if(!context.LevelConfigData.blacklisted.roleIds.find(role.id)) {

            context.LevelConfigData.blacklisted.roleIds.push(role.id)
            await Cache_Levels.setType(guildId, 'blacklisted', context.LevelConfigData.blacklisted.roleIds)
            client.utils.Embed(interaction, Colors.Blurple, 'Levels Settings', `${role} is added to the blacklist`);
            
        } else {
            context.LevelConfigData.blacklisted.roleIds.filter(roles => roles !== role.id)
            await Cache_Levels.setType(guildId, 'blacklisted', context.LevelConfigData.blacklisted.roleIds)
            client.utils.Embed(interaction, Colors.Blurple, 'Levels Settings', `${role} is removed to the blacklist`);
        }

        // disable


    } else if (channel !== null) {
        client.utils.Embed(interaction, Colors.Blurple, 'Levels Settings', `${channel} is the channel you wanna blacklist`);
    } else {
        client.utils.Embed(interaction, Colors.Blurple, 'Levels Settings', `Something went wrong, please contact the developer`);
    }

};