const { Colors, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups')
const Cache_Levels = require('../../../cache/Levels');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function XPMultiplierSetting(interaction, context) {
    const { client, options, guildId, memberPermissions } = interaction;

    client.utils.Embed(interaction, Colors.Blurple, 'Levels Settings', `Blacklisting roles/channels will be coming soon`);
};