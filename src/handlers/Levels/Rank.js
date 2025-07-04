const { Colors, EmbedBuilder } = require('discord.js');
const { LevelConfigType } = require('../../models/GuildSetups')
const { progressBar, ExpForLevel } = require('../../utils/Functions/Levels/XPMathematics')
const Cache_XP = require('../../cache/XP');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function LevelsRank(interaction, context) {
    const { client, options, guildId, memberPermissions, user, guild } = interaction;
    const { LevelConfigData } = context;

    if(!LevelConfigData) return client.utils.Embed(interaction, Colors.Red, 'Error Levels', `No configuration found for guild \`${guild.name}\``);
    if(!LevelConfigData.enabled) return client.utils.Embed(interaction, Colors.Red, 'Error Levels', `This guild hasn't configured levels for this server, advise an admin to use \`/levels setup\``);
    
    const tUser = options.getUser('user') || user;

    if(tUser.bot) return client.utils.Embed(interaction, Colors.Red, 'Levels', `${tUser}, is a bot they cannot gain XP`, [], false);

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
            { name: 'Daily Streak', value: `**${userConfig.dailyStreak}**`, inline: true },

            { name: 'Messages', value: `**${userConfig.totalMessages}**`, inline: true },
            { name: 'Voice', value: `**${userConfig.totalVoice}** minutes`, inline: true }
        )
        .setImage('https://i.sstatic.net/Fzh0w.png');

    await interaction.reply({ embeds: [rankEmbed] });
    
    
};