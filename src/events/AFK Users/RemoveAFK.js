const { Events, EmbedBuilder, PermissionFlagsBits, Message } = require('discord.js');
const { AFKUsers } = require('../../models/GuildSetups.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const { permissionCheck } = require('../../utils/Checks.js');
const { DeveloperMode } = process.env;

module.exports = {
    name: Events.MessageCreate,
    once: false,
    nickname: 'AFK Users',

    /**
     * @param {Message} message
     */
    async execute(message) {
        const { client, guild, member, channel, content, author } = message;

        // Exit if message is from a bot or outside a guild
        if (!guild || author.bot || DeveloperMode === 'true') return;

        try {
            // Check bot permissions
            const requiredPermissions = [
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks
            ];
            const [hasPermissions, missingPermissions] = permissionCheck(channel, requiredPermissions, client);

            if (!hasPermissions) {
                return;
            }

            const AFKUser = await AFKUsers.findOne({ userId: author.id });
            if (!AFKUser) return;

            await AFKUser.deleteOne();

            const AFKEmbed = new EmbedBuilder()
                .setTitle('AFK')
                .setColor('Blurple')
                .setDescription(`Welcome back ${author}! I have removed you from the AFK list.`);

            await channel.send({ embeds: [AFKEmbed] });

        } catch (error) {
            cleanConsoleLogData('AFK Users', `Error: ${error.message}`, 'error');
        }
    }
}