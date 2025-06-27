const { Colors, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { LevelConfig } = require('../../models/GuildSetups')
const { progressBar, ExpForLevel } = require('../../utils/Functions/Levels/XPMathematics')
const Cache_XP = require('../../cache/XP');
const Cache_Levels_Config = require('../../cache/Levels');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfig }} context
 */
module.exports = async function LevelsRank(interaction) {
    const { client, options, guildId, memberPermissions, user, guild } = interaction;
    
    const tUser = options.getUser('user') || user;

    const guildConfig = await Cache_Levels_Config.get(guildId)
    if(!guildConfig) return client.utils.Embed(interaction, Colors.Red, 'Error Levels', `No configuration found for guild \`${guild.name}\``);

    const userConfig = await Cache_XP.get(guildId, tUser.id);
    if(!userConfig) return client.utils.Embed(interaction, Colors.Red, 'Levels', `${tUser}, doesn't have a level`);

    if(userConfig.level === 0 && userConfig.xp === 0) return client.utils.Embed(interaction, Colors.Red, 'Levels', `${tUser}, doesn't have a level`, [], false);

    const rankEmbed = new EmbedBuilder()
        .setColor('Blurple')
        .setTitle(`@${tUser.username}'s Rank`)
        .setThumbnail(tUser.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Level', value: `**${userConfig.level}**`, inline: true },
            { name: 'XP', value: `**${progressBar(userConfig.xp, ExpForLevel(userConfig.level))}**`, inline: true },

            { name: 'Messages', value: `**${userConfig.totalMessages}**`, inline: false },
            { name: 'Voice Time', value: `**${userConfig.totalVoice}** minutes`, inline: false },
            { name: 'Daily Streak', value: `**${userConfig.dailyStreak}**`, inline: false }
        )
        .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp()
        .setImage('https://i.sstatic.net/Fzh0w.png');

    await interaction.reply({ embeds: [rankEmbed] });
    
    
};