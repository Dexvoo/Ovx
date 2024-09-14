const { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent, GuildChannel } = require('discord.js');
const { ChannelLogs } = require('../../../models/GuildSetups');
const { permissionCheck } = require('../../../utils/Checks');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DisabledFeatures } = require('../../../utils/Embeds');
const { DeveloperMode } = process.env;

module.exports = {
    name: Events.ChannelCreate,
    once: false,
    nickname: 'Channel Create Logs',

    /**
     * @param {GuildChannel} channel
     */

    async execute(channel) {
        const { client, guild } = channel;

        if(!guild || DeveloperMode === 'true') return;

        const guildChannelLogs = await ChannelLogs.findOne({ guildId: guild.id });

        if(!guildChannelLogs || !guildChannelLogs.channelId || !guildChannelLogs.enabled) return cleanConsoleLogData('Channel Created', `Guild: ${guild.name} | Disabled`, 'warning');

        const targetChannel = guild.channels.cache.get(guildChannelLogs.channelId);

        if(!targetChannel) {
            
            guildChannelLogs.enabled = false;
            await guildChannelLogs.save().catch(() => { });
            
            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            
            return DisabledFeatures(client, guildOwner, 'Channel Logs', `Channel not found`);
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(targetChannel, botPermissions, client);

        if(!hasPermission) {

            guildChannelLogs.enabled = false;
            await guildChannelLogs.save().catch(() => { });

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Channel Logs', `Missing Permissions: \`${missingPermissions}\``);
        }

        const fetchedLogs = await guild.fetchAuditLogs(
            { limit: 1, type: AuditLogEvent.ChannelCreate }
        ).catch(() => { return false });

        const creationLog = fetchedLogs?.entries?.first();
        let executor = creationLog ? creationLog.executor : null;

        if(!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) executor = 'Bot Missing Permission: `ViewAuditLog` ';

        const description = [
            `${channel}`,
            `Channel ID: ${channel.id}`,
        ];

        if(executor) description.push(`Created by: ${executor}`);

        const ChannelCreated = new EmbedBuilder()
            .setColor('Blurple')
            .setTitle(`Channel Created`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `ID: ${channel.id}` });

        targetChannel.send({ embeds: [ChannelCreated] }).catch(() => { });
    }
};