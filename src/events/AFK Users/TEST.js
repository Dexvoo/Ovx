const { Events, EmbedBuilder, Message, PermissionFlagsBits, GuildAuditLogsEntry, Guild, ApplicationCommandType, AuditLogEvent } = require('discord.js');
const { RoleLogs } = require('../../models/GuildSetups.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const { DisabledFeatures } = require('../../utils/Embeds');
const { permissionCheck } = require('../../utils/Checks.js');
const { DeveloperMode } = process.env;

module.exports = {
    name: Events.GuildAuditLogEntryCreate,
    once: false,
    nickname: 'TEST',

    /**
     * @param {GuildAuditLogsEntry} GuildAuditLogsEntry
     * @param {Guild} guild
     */

    async execute(GuildAuditLogsEntry, guild) {
        const { action } = GuildAuditLogsEntry;
        const { client } = guild;
        console.log(`Action: ${action}`);
        // if(DeveloperMode === 'true') return;

        if(AuditLogEvent.RoleCreate === action) {
            return HandleRoleCreate(GuildAuditLogsEntry, guild, client);
        } else if(AuditLogEvent.RoleDelete === action) {
            return HandleRoleDelete(GuildAuditLogsEntry, guild, client);
        } else if(AuditLogEvent.RoleUpdate === action) {
            return HandleRoleUpdate(GuildAuditLogsEntry, guild, client);
        }

        
    }
}

/**
 * @param {GuildAuditLogsEntry} GuildAuditLogsEntry
 * @param {Guild} guild
 * @param {Client} client
 */
async function HandleRoleUpdate(GuildAuditLogsEntry, guild, client) {
    const { target, action } = GuildAuditLogsEntry;

    const guildRoleLogs = await RoleLogs.findOne({ guildId: guild.id });

    if(!guildRoleLogs || !guildRoleLogs.channelId || !guildRoleLogs.enabled) return cleanConsoleLogData('Role Updated', `Guild: ${guild.name} | Disabled`, 'warning');

    const targetChannel = guild.channels.cache.get(guildRoleLogs.channelId);

    if(!targetChannel) {

        guildRoleLogs.enabled = false;
        await guildRoleLogs.save();

        const guildOwner = await guild.fetchOwner();
        if(!guildOwner) return;
        return DisabledFeatures(client, guildOwner, 'Role Logs', `Channel not found`);
    }

    const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
    const [hasPermission, missingPermission] = permissionCheck(targetChannel, botPermissions, client);

    if(!hasPermission) {
        guildRoleLogs.enabled = false;
        await guildRoleLogs.save();

        const guildOwner = await guild.fetchOwner();
        if(!guildOwner) return;
        return DisabledFeatures(client, guildOwner, 'Role Logs', `Missing Permission: ${missingPermission}`);
    }

    const description = [
        `${target}`,
    ]

    if(GuildAuditLogsEntry.executorId) {
        description.push(`Updated by: <@!${GuildAuditLogsEntry.executorId}>`);
    }

    // check for changes
    var changes = [];
    if(GuildAuditLogsEntry.changes) {
        for(const change of GuildAuditLogsEntry.changes) {
            changes.push(`**${change.key}**: ${change.old} => ${change.new}`);
        }
    }

    if(changes.length) {
        description.push(`Changes:\n${changes.join('\n')}`);
    }

    


    const embed = new EmbedBuilder()
        .setColor('Blurple')
        .setTitle('Role Updated')
        .setDescription(description.join('\n'))
        .setFooter({text: `ID: ${target.id}`})
        .setTimestamp();

    targetChannel.send({ embeds: [embed] });
}

/**
 * @param {GuildAuditLogsEntry} GuildAuditLogsEntry
 * @param {Guild} guild
 * @param {Client} client
 */
async function HandleRoleCreate(GuildAuditLogsEntry, guild, client) {
    const { target, action } = GuildAuditLogsEntry;

    const guildRoleLogs = await RoleLogs.findOne({ guildId: guild.id });

    if(!guildRoleLogs || !guildRoleLogs.channelId || !guildRoleLogs.enabled) return cleanConsoleLogData('Role Created', `Guild: ${guild.name} | Disabled`, 'warning');

    const targetChannel = guild.channels.cache.get(guildRoleLogs.channelId);

    if(!targetChannel) {

        guildRoleLogs.enabled = false;
        await guildRoleLogs.save();

        const guildOwner = await guild.fetchOwner();
        if(!guildOwner) return;
        return DisabledFeatures(client, guildOwner, 'Role Logs', `Channel not found`);
    }

    const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
    const [hasPermission, missingPermission] = permissionCheck(targetChannel, botPermissions, client);

    if(!hasPermission) {
        guildRoleLogs.enabled = false;
        await guildRoleLogs.save();

        const guildOwner = await guild.fetchOwner();
        if(!guildOwner) return;
        return DisabledFeatures(client, guildOwner, 'Role Logs', `Missing Permission: ${missingPermission}`);
    }

    const description = [
        `${target}`,
    ]

    if(GuildAuditLogsEntry.executorId) {
        description.push(`Created by: <@!${GuildAuditLogsEntry.executorId}>`);
    }

    const embed = new EmbedBuilder()
        .setColor('Blurple')
        .setTitle('Role Created')
        .setDescription(description.join('\n'))
        .setFooter({text: `ID: ${target.id}`})
        .setTimestamp();

    targetChannel.send({ embeds: [embed] });
}

/**
 * @param {GuildAuditLogsEntry} GuildAuditLogsEntry
 * @param {Guild} guild
 * @param {Client} client
 */
async function HandleRoleDelete(GuildAuditLogsEntry, guild, client) {
    const { target, action } = GuildAuditLogsEntry;

    const guildRoleLogs = await RoleLogs.findOne({ guildId: guild.id });

    if(!guildRoleLogs || !guildRoleLogs.channelId || !guildRoleLogs.enabled) return cleanConsoleLogData('Role Deleted', `Guild: ${guild.name} | Disabled`, 'warning');

    const targetChannel = guild.channels.cache.get(guildRoleLogs.channelId);

    if(!targetChannel) {

        guildRoleLogs.enabled = false;
        await guildRoleLogs.save();

        const guildOwner = await guild.fetchOwner();
        if(!guildOwner) return;
        return DisabledFeatures(client, guildOwner, 'Role Logs', `Channel not found`);
    }

    const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
    const [hasPermission, missingPermission] = permissionCheck(targetChannel, botPermissions, client);

    if(!hasPermission) {
        guildRoleLogs.enabled = false;
        await guildRoleLogs.save();

        const guildOwner = await guild.fetchOwner();
        if(!guildOwner) return;
        return DisabledFeatures(client, guildOwner, 'Role Logs', `Missing Permission: ${missingPermission}`);
    }

    const description = [
        `${target}`,
    ]

    if(GuildAuditLogsEntry.executorId) {
        description.push(`Deleted by: <@!${GuildAuditLogsEntry.executorId}>`);
    }

    const embed = new EmbedBuilder()
        .setColor('Blurple')
        .setTitle('Role Deleted')
        .setDescription(description.join('\n'))
        .setFooter({text: `ID: ${target.id}`})
        .setTimestamp();

    targetChannel.send({ embeds: [embed] });
    
}