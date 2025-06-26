const { Colors, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { LevelConfig } = require('../../models/GuildSetups')
require('dotenv').config()
/**
 * @param {ChatInputCommandInteraction} interaction
 * @param {{ LevelConfigData: LevelConfig }} context
 */
module.exports = async function LevelsLeaderboard(interaction) {
    const { client, options, guildId } = interaction;
    
    const type = options.getString('type');
    
    
};