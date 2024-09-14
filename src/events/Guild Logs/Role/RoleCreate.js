const { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const { RoleLogs } = require('../../../models/GuildSetups');
const { permissionCheck } = require('../../../utils/Checks');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DisabledFeatures } = require('../../../utils/Embeds');
const { DeveloperMode } = process.env;


module.exports = {
    name: Events.GuildRoleCreate,
    once: false,
    nickname: 'Role Create Logs',

    /**
     * @param {Role} role
     */

    async execute(role) {
        const { client, guild } = role;

        if(!guild || DeveloperMode === 'true') return;

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
            { limit: 1, type: AuditLogEvent.RoleCreate }
        ).catch(() => { return false });

        const creationLog = fetchedLogs?.entries?.first();
        let executor = creationLog ? creationLog.executor : null;

        if(!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) executor = 'Bot Missing Permission: `ViewAuditLog` ';

        const description = [
            `${role}`,
            `Role ID: ${role.id}`,
        ];

        if(executor) description.push(`Created by: ${executor}`);

        const embed = new EmbedBuilder()
            .setColor('Blurple')
            .setTitle('Role Created')
            .setDescription(description.join('\n'))
            .setTimestamp();

        targetChannel.send({ embeds: [embed] }).catch(() => { });

    }
};