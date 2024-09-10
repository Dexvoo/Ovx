const { Events, EmbedBuilder, Message, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const { RoleLogs } = require('../../../models/GuildSetups');
const { permissionCheck } = require('../../../utils/Checks');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DisabledFeatures } = require('../../../utils/Embeds');


module.exports = {
    name: Events.GuildRoleDelete,
    once: false,
    nickname: 'Role Delete Logs',

    /**
     * @param {Role} role
     */

    async execute(role) {
        const { client, guild } = role;

        if(!guild) return;

        const guildRoleLogs = await RoleLogs.findOne({ guildId: guild.id });

        if(!guildRoleLogs || !guildRoleLogs.channelId || !guildRoleLogs.enabled) return cleanConsoleLogData('Role Created', `Guild: ${guild.name} | Disabled`, 'warning');

        const targetChannel = guild.channels.cache.get(guildRoleLogs.channelId);

        if(!targetChannel) {
            
            guildRoleLogs.enabled = false;
            await guildRoleLogs.save().catch(() => { });
            
            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Role Logs', `Channel not found`);
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(targetChannel, botPermissions, client);

        if(!hasPermission) {

            guildRoleLogs.enabled = false;
            await guildRoleLogs.save().catch(() => { });
            
            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Role Logs', `Missing Permissions: \`${missingPermissions}\``);
        }

        const fetchedLogs = await guild.fetchAuditLogs(
            { limit: 1, type: AuditLogEvent.RoleDelete }
        ).catch(() => { return false });

        const creationLog = fetchedLogs?.entries?.first();
        let executor = creationLog ? creationLog.executor : null;

        if(!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) executor = 'Bot Missing Permission: `ViewAuditLog` ';

        const description = [
            `@${role.name}`,
            `Role ID: ${role.id}`,
        ];

        if(executor) description.push(`Created by: ${executor}`);

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('Role Deleted')
            .setDescription(description.join('\n'))
            .setTimestamp();

        targetChannel.send({ embeds: [embed] }).catch(() => { });

    }
};