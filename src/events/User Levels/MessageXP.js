const { EmbedBuilder, Events, PermissionFlagsBits } = require('discord.js');
const { permissionCheck } = require('../../utils/Checks.js');
const { LevelNotifications } = require('../../models/GuildSetups.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const { addUserMessageXP } = require('../../utils/Levels/XP-Database.js');
const cooldowns = new Set();
const { DeveloperIDs, DisabledFeaturesChannelID, DevGuildID } = process.env;

module.exports = {
    name: Events.MessageCreate,
    once: false,
    nickname: 'Message XP',

    /**
     * @param {Message} message
     * @returns
     * @description Message XP
     */
    async execute(message) {
        const { client, guild, user, content, author, member } = message;

        // Exit if message is from a bot or outside a guild
        if (!guild || author.bot) return;

        try {
            const guildLevelNotifications = await LevelNotifications.findOne({ guildId: guild.id });
            if (!guildLevelNotifications || !guildLevelNotifications.enabled) return;

            const channel = guild.channels.cache.get(guildLevelNotifications.channelId);
            const DisabledFeaturesChannel = client.guilds.cache.get(DevGuildID).channels.cache.get(DisabledFeaturesChannelID);
            if (!channel) {

                
                if (DisabledFeaturesChannel) {
                    const Embed = new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(`${guild.name} | Levels | Levels disabled | Channel not found`);
                    await DisabledFeaturesChannel.send({ embeds: [Embed] });
                }
                await guildLevelNotifications.updateOne({ enabled: false });
                return;
            }
            

            // Check bot permissions
            const requiredPermissions = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageRoles];
            const [hasPermissions] = permissionCheck(channel, requiredPermissions, client);

            if (!hasPermissions) {
                // disable levels
                await guildLevelNotifications.updateOne({ enabled: false });

                const Embed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription(`${guild.name} | Levels | Levels disabled | Missing Permissions : \`${missingPermissions}\``);
                await DisabledFeaturesChannel.send({ embeds: [Embed] });
            }

            // Check if user is on cooldown
            if (cooldowns.has(author.id)) return;

            await addUserMessageXP(member, channel, guildLevelNotifications.levelRewards);

            if (!DeveloperIDs.includes(author.id)) {
                AddCooldown(author.id);
            }

        } catch (error) {
            cleanConsoleLogData('Message XP', `Error: ${error.message}`, 'error');
        }
    }
}

function AddCooldown(user) {
    cooldowns.add(user.id);
    setTimeout(() => cooldowns.delete(user.id), 60000);
}
