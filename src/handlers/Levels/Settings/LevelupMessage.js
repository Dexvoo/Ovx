const { Colors, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { SendEmbed, ShortTimestamp } = require('../../../utils/LoggingData');
const { LevelConfigType } = require('../../../models/GuildSetups')
const { permissionCheck } = require('../../../utils/Permissions');
const Cache_Levels = require('../../../cache/Levels');
require('dotenv').config()

const { DeveloperIDs } = process.env;

/**
 * @param {ChatInputCommandInteraction} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function LevelupMessageSetting(interaction, context) {
    const { client, options, guildId, memberPermissions } = interaction;
    const { LevelConfigData } = context
    
    const levelupMessage = options.getString('message') || '{user}, you just gained a level! Current Level: **{level}**!';
    if(!LevelConfigData.enabled) return SendEmbed(interaction, Colors.Red, 'Failed Settings', 'Levels are currently not enabled on this server.\nAsk a server admin to use `/level setup`', []);
    if(!memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) return SendEmbed(interaction, Colors.Red, 'Failed Setup', 'User Missing Permissions | \`ManageGuild\`', []);
    
    await Cache_Levels.setType(guildId, 'levelUpMessage', levelupMessage);
    SendEmbed(interaction, Colors.Blurple, 'Levels Settings', `Successfully set guild level up message to \`${levelupMessage}\``);
};