const { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent, GuildChannel } = require('discord.js');
const { ChannelLogs } = require('../../../models/GuildSetups');
const { permissionCheck } = require('../../../utils/Checks');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DisabledFeatures } = require('../../../utils/Embeds');

module.exports = {
    name: Events.ChannelUpdate,
    once: false,
    nickname: 'Channel Update Logs',

    /**
     * @param {GuildChannel} oldChannel
     * @param {GuildChannel} newChannel
     */

    async execute(oldChannel, newChannel) {
        const { client, guild } = newChannel;

        if(!guild) return;

        const guildChannelLogs = await ChannelLogs.findOne({ guildId: guild.id });

        if(!guildChannelLogs || !guildChannelLogs.channelId || !guildChannelLogs.enabled) return cleanConsoleLogData('Channel Updated', `Guild: ${guild.name} | Disabled`, 'warning');

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
            { limit: 1, type: AuditLogEvent.ChannelUpdate }
        ).catch(() => { return false });

        const updateLog = fetchedLogs?.entries?.first();
        let executor = updateLog ? updateLog.executor : null;

        if(!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) executor = 'Bot Missing Permission: `ViewAuditLog` ';
    }   
};