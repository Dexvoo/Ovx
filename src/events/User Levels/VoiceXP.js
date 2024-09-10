const { EmbedBuilder, Events, PermissionFlagsBits, VoiceState } = require('discord.js');
const { permissionCheck } = require('../../utils/Checks.js');
const { LevelNotifications } = require('../../models/GuildSetups.js');
const { UserLevels } = require('../../models/Levels.js');
const { ExpForLevel, LevelForExp, VoiceXP } = require('../../utils/Levels/XPMathematics.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const { addUserVoiceXP } = require('../../utils/Levels/XP-Database.js');
const cooldowns = new Set();
const { DeveloperIDs } = process.env;
const inVoiceChannelMembers = new Map();
const userDataCache = new Map();
const batchUpdatesQueue = new Map();

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,
    nickname: 'Voice XP',


    /**
     * @param {VoiceState} oldState
     * @param {VoiceState} newState
     */
    
    async execute(oldState, newState) {
        const { guild, member, client, channel } = newState;

        if (!guild || member.user.bot) return;

        const guildLevelNotifications = await LevelNotifications.findOne({ guildId: guild.id });
        if (!guildLevelNotifications || !guildLevelNotifications.enabled) return;

        if(!oldState.channel && newState.channel) {
            inVoiceChannelMembers.set(member.user.id, {
                channel: newState.channel,
                time: Date.now(),
            });
            cleanConsoleLogData('Voice Log', `Joined Voice Channel ${newState.channel.name}`, 'debug');
            return;
        }

        if(oldState.channel && !newState.channel || !newState.channel) {
            if(!inVoiceChannelMembers.has(member.user.id)) return;
            cleanConsoleLogData('Voice Log', `Left Voice Channel ${oldState?.channel?.name || 'Channel was deleted'}`, 'debug');

            const joinData = inVoiceChannelMembers.get(member.user.id);
            const timeInChannel = Date.now() - joinData.time;
            const timeInChannelMinutes = Math.floor(timeInChannel / 1000 / 60);

            if(timeInChannelMinutes < 3 && !DeveloperIDs.includes(member.user.id)) {
                cleanConsoleLogData('Voice Log', `User @${member.user.username} left voice channel ${oldState.channel.name} before 3 minutes`, 'debug');
                inVoiceChannelMembers.delete(member.user.id);
                return;
            }

            const guildLevelNotifications = await LevelNotifications.findOne({ guildId: guild.id });
            if (!guildLevelNotifications || !guildLevelNotifications.enabled) return;

            const targetChannel = guild.channels.cache.get(guildLevelNotifications.channelId);
            const DisabledFeaturesChannel = guild.channels.cache.get(guildLevelNotifications.disabledChannelId);
            if (!targetChannel) {

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
            const [hasPermissions] = permissionCheck(targetChannel, requiredPermissions, client);

            if (!hasPermissions) {
                await guildLevelNotifications.updateOne({ enabled: false });

                const Embed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription(`${guild.name} | Levels | Levels disabled | Missing Permissions : \`${missingPermissions}\``);
                await DisabledFeaturesChannel.send({ embeds: [Embed] });
            }

            await addUserVoiceXP(member, targetChannel, guildLevelNotifications.levelRewards, timeInChannelMinutes);
        }
    }
};