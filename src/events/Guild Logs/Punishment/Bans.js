const { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent, GuildBan } = require('discord.js');
const { PunishmentLogs } = require('../../../models/GuildSetups');
const { permissionCheck } = require('../../../utils/Checks');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DisabledFeatures } = require('../../../utils/Embeds');
const { DeveloperMode } = process.env;

module.exports = {
    name: Events.GuildBanAdd,
    once: false,
    nickname: 'Ban Logs',

    /**
     * @param {GuildBan} ban
     */

    async execute(ban) {
        const { guild, client, user, reason } = ban;

        if(!guild || DeveloperMode === 'true') return;

        const guildPunishmentLogs = await PunishmentLogs.findOne({ guildId: guild.id });

        if(!guildPunishmentLogs || !guildPunishmentLogs.channelId || !guildPunishmentLogs.enabled) return cleanConsoleLogData('User Banned', `Guild: ${guild.name} | Disabled`, 'warning');

        const targetChannel = guild.channels.cache.get(guildPunishmentLogs.channelId);

        if(!targetChannel) {
            
            guildPunishmentLogs.enabled = false;
            await guildPunishmentLogs.save().catch(() => { });
            
            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Punishment Logs', `Channel not found`);
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(targetChannel, botPermissions, client);

        if(!hasPermission) {

            guildPunishmentLogs.enabled = false;
            await guildPunishmentLogs.save().catch(() => { });

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Punishment Logs', `Missing Permissions: \`${missingPermissions}\``);
        }

        const fetchedLogs = await guild.fetchAuditLogs(
            { limit: 1, type: AuditLogEvent.MemberBanAdd }
        ).catch(() => { return false });

        const deletionLog = fetchedLogs?.entries?.first();
        let executor = deletionLog ? deletionLog.executor : null;
        
        if(!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) executor = 'Bot Missing Permission: `ViewAuditLog` ';

        const description = [
            `Username: @${user.username}`,
            `Reason: ${reason || 'No reason provided'}`,
        ];
        
        if(executor) description.push(`Banned by: ${executor}`);

        const MessageDeleteEmbed = new EmbedBuilder()
            .setColor('Red')
            .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
            .setTitle(`User Banned`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `ID: ${user.id}` })
            .setTimestamp();
        targetChannel.send({ embeds: [MessageDeleteEmbed] }).catch(() => { });
        
    }
}
