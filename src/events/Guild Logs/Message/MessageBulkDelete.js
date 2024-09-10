const { Events, EmbedBuilder, Message, PermissionFlagsBits, AuditLogEvent, GuildChannel } = require('discord.js');
const { MessageLogs } = require('../../../models/GuildSetups');
const { permissionCheck } = require('../../../utils/Checks');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DisabledFeatures } = require('../../../utils/Embeds');

module.exports = {
    name: Events.MessageBulkDelete,
    once: false,
    nickname: 'Message Bulk Delete Logs',

    /**
     * @param {Message} messages
     * @param {GuildChannel} channel
     */

    async execute(messages, channel) {
        const { client, guild } = channel;

        if(!guild) return;

        const guildMessageLogs = await MessageLogs.findOne({ guildId: guild.id });

        if(!guildMessageLogs || !guildMessageLogs.channelId || !guildMessageLogs.enabled) return cleanConsoleLogData('Bulk Messages Deleted', `Guild: ${guild.name} | Disabled`, 'warning');

        const targetChannel = guild.channels.cache.get(guildMessageLogs.channelId);

        if(!targetChannel) {
            
            guildMessageLogs.enabled = false;
            await guildMessageLogs.save().catch(() => { });
            
            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Message Logs', `Channel not found`);
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(targetChannel, botPermissions, client);

        if(!hasPermission) {

            guildMessageLogs.enabled = false;
            await guildMessageLogs.save().catch(() => { });

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Message Logs', `Missing Permissions: \`${missingPermissions}\``);
        }

        const fetchedLogs = await guild.fetchAuditLogs(
            { limit: 1, type: AuditLogEvent.MessageBulkDelete }
        ).catch(() => { return false });

        const deletionLog = fetchedLogs?.entries?.first();
        let executor = deletionLog ? deletionLog.executor : null;
        
        if(!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) executor = 'Bot Missing Permission: `ViewAuditLog` ';
        
        const description = [
            `${messages.size} messages`,
        ];
        
        if(executor) description.push(`Deleted by: ${executor}`);

        const MessageDeleteEmbed = new EmbedBuilder()
            .setColor('Red')
            .setTitle(`Message Bulk Delete in #${channel.name}`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `ID: ${channel.id}` })
            .setTimestamp();
        targetChannel.send({ embeds: [MessageDeleteEmbed] }).catch(() => { });
        
    }
}
