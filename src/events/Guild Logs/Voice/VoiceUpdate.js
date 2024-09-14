const { EmbedBuilder, VoiceState, Events, PermissionFlagsBits } = require('discord.js');
const { VoiceLogs } = require('../../../models/GuildSetups');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DisabledFeatures } = require('../../../utils/Embeds');
const { permissionCheck } = require('../../../utils/Checks');
const { DeveloperMode } = process.env;

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,
    nickname: 'Voice Update',

    /**
     * @param {VoiceState} oldState
     * @param {VoiceState} newState
     * @returns
     */

    async execute(oldState, newState) {
        const { guild, member, client, channel } = newState;

        if (!guild || DeveloperMode === 'true') return;

        const guildVoiceLogs = await VoiceLogs.findOne({ guildId: guild.id });

        if (!guildVoiceLogs || !guildVoiceLogs.channelId || !guildVoiceLogs.enabled) return cleanConsoleLogData('Voice Update', `Guild: ${guild.name} | Disabled`, 'warning');

        const targetChannel = guild.channels.cache.get(guildVoiceLogs.channelId);

        if (!targetChannel) {

            guildVoiceLogs.enabled = false;
            await guildVoiceLogs.save().catch(() => { });

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Voice Logs', `Channel not found`);
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(targetChannel, botPermissions, client);

        if (!hasPermission) {

            guildVoiceLogs.enabled = false;
            await guildVoiceLogs.save().catch(() => { });

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Voice Logs', `Missing Permissions: \`${missingPermissions}\``);
        }
        
        if(!oldState.channel && newState.channel) {
            const JoinedVoiceChannel = new EmbedBuilder()
            .setColor('Blurple')
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setTitle(`Member Joined Voice Channel`)
            .setDescription(`${newState.channel}`)
            .setFooter({ text: `ID: ${member.id}`, })
            .setTimestamp();
            return targetChannel.send({ embeds: [JoinedVoiceChannel] });
            
        }
        
        if(oldState.channel && !newState.channel) {
            const LeftVoiceChannel = new EmbedBuilder()
            .setColor('Red')
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setTitle(`Member Left Voice Channel`)
            .setDescription(`${oldState.channel}`)
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp();
            return targetChannel.send({ embeds: [LeftVoiceChannel] });
        }
        
        if(!channel) {
            const LeftVoiceChannel = new EmbedBuilder()
                .setColor('Red')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setTitle(`Member Left Voice Channel`)
                .setDescription(`Channel: Channel Not Found`)
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();
            return targetChannel.send({ embeds: [LeftVoiceChannel] });
        }

        if(oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            const SwitchedVoiceChannel = new EmbedBuilder()
                .setColor('Orange')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setTitle(`Member Switched Voice Channel`)
                .setDescription(`From: ${oldState.channel}\nTo: ${newState.channel}`)
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();
            return targetChannel.send({ embeds: [SwitchedVoiceChannel] });
        }

        if(oldState.serverDeaf && !newState.serverDeaf) {
            const ServerUndeafened = new EmbedBuilder()
                .setColor('Green')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setTitle(`Member Server Undeafened`)
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();
            return targetChannel.send({ embeds: [ServerUndeafened] });
        }

        if(!oldState.serverDeaf && newState.serverDeaf) {
            const ServerDeafened = new EmbedBuilder()
                .setColor('Red')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setTitle(`Member Server Deafened`)
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();
            return targetChannel.send({ embeds: [ServerDeafened] });
        }

        if(oldState.serverMute && !newState.serverMute) {
            const ServerUnmuted = new EmbedBuilder()
                .setColor('Green')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setTitle(`Member Server Unmuted`)
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();
            return targetChannel.send({ embeds: [ServerUnmuted] });
        }

        if(!oldState.serverMute && newState.serverMute) {
            const ServerMuted = new EmbedBuilder()
                .setColor('Red')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setTitle(`Member Server Muted`)
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();
            return targetChannel.send({ embeds: [ServerMuted] });
        }

        if(oldState.selfVideo && !newState.selfVideo) {
            const VideoDisabled = new EmbedBuilder()
                .setColor('Red')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setTitle(`Member Disabled Video`)
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();
            return targetChannel.send({ embeds: [VideoDisabled] });
        }

        if(!oldState.selfVideo && newState.selfVideo) {
            const VideoEnabled = new EmbedBuilder()
                .setColor('Green')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setTitle(`Member Enabled Video`)
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();
            return targetChannel.send({ embeds: [VideoEnabled] });
        }

        cleanConsoleLogData('Voice Update', `Guild: ${guild.name} | No Changes Detected `, 'warning');

    }

};