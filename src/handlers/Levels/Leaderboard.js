const { Colors, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { SendEmbed, ShortTimestamp } = require('../../utils/LoggingData');
const { LevelConfig } = require('../../models/GuildSetups')
const { permissionCheck } = require('../../utils/Permissions');
require('dotenv').config()

const { DeveloperIDs } = process.env;

/**
 * @param {ChatInputCommandInteraction} interaction
 * @param {{ LevelConfigData: LevelConfig }} context
 */
module.exports = async function LevelsLeaderboard(interaction) {
    const { client, options, guildId } = interaction;
    
    const type = options.getString('type');
    
    
};