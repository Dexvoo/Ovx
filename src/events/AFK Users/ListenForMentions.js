const { Events, EmbedBuilder, Message, PermissionFlagsBits } = require('discord.js');
const { AFKUsers } = require('../../models/GuildSetups.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs');
const { permissionCheck } = require('../../utils/Checks');
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

            // check if message has mentions
            if (message.mentions.users.size === 0) return;

            // Check bot permissions
            const requiredPermissions = [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
            const [hasPermissions, missingPermissions] = permissionCheck(channel, requiredPermissions, client);

            if (!hasPermissions) return;

            // Detect mentions
            const mentionRegex = /<@!?(\d+)>/g;
            const mentionMatch = content.match(mentionRegex);
            if (!mentionMatch) return;

            const userId = mentionMatch[0].replace(/<@!?|>/g, '');

            if (userId === author.id) return;
            const userAFK = await AFKUsers.findOne({ userId: userId });
            if (!userAFK) return;

            const clientUser = client.users.cache.get(userId);

            const TimeString = `<t:${Math.floor( new Date(userAFK.timestamp).getTime() / 1000 )}:R>`
            const AFKEmbed = new EmbedBuilder()
                .setTitle('AFK User Detected')
                .setColor('Blurple')
                .setDescription(`${clientUser}: ${TimeString}\n@${clientUser.username} : ${userAFK.reason}`);

            await channel.send({ embeds: [AFKEmbed] });

        } catch (error) {
            cleanConsoleLogData('AFK Users', `Error: ${error.message}`, 'error');
        }
    }
}