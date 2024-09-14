const { Events, AuditLogEvent, PermissionFlagsBits, GuildMember, EmbedBuilder } = require('discord.js');
const { PunishmentLogs } = require('../../../models/GuildSetups');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { permissionCheck } = require('../../../utils/Checks');
const { DeveloperMode } = process.env;

module.exports = {
    name: Events.GuildMemberUpdate,
    once: false,
    nickname: 'Timeouts',

    /**
     * @param {GuildMember} oldMember
     * @param {GuildMember} newMember
     */

    async execute(oldMember, newMember) {
        const { guild, client } = newMember;

        if (!guild || DeveloperMode === 'true') return;

        if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
            // If the new timestamp is null, the timeout has been removed

            const guildPunishmentLogs = await PunishmentLogs.findOne({ guildId: guild.id });

            if (!guildPunishmentLogs || !guildPunishmentLogs.channelId || !guildPunishmentLogs.enabled) return cleanConsoleLogData('Timeout', `Guild: ${guild.name} | Disabled`, 'warning');

            const targetChannel = guild.channels.cache.get(guildPunishmentLogs.channelId);

            if (!targetChannel) {

                guildPunishmentLogs.enabled = false;
                await guildPunishmentLogs.save().catch(() => { });

                const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
                return DisabledFeatures(client, guildOwner, 'Timeout Logs', `Channel not found`);
            }

            const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
            const [hasPermission, missingPermissions] = permissionCheck(targetChannel, botPermissions, client);

            if (!hasPermission) {

                guildPunishmentLogs.enabled = false;
                await guildPunishmentLogs.save().catch(() => { });

                const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
                return DisabledFeatures(client, guildOwner, 'Timeout Logs', `Missing Permissions: \`${missingPermissions}\``);
            }

            const fetchedLogs = await guild.fetchAuditLogs(
                { limit: 1, type: AuditLogEvent.MemberUpdate }
            ).catch(() => { return false });

            const deletionLog = fetchedLogs?.entries?.first();

            let executor = deletionLog ? deletionLog.executor : null;

            if (!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) executor = 'Bot Missing Permission: `ViewAuditLog` ';


            if (newMember.communicationDisabledUntilTimestamp === null) {

                const description = [
                    `Username: @${newMember.user.username}`,
                ];

                if (executor) description.push(`Timeout removed by: ${executor}`);

                const embed = new EmbedBuilder()
                    .setTitle('Timeout Removed')
                    .setDescription(description.join('\n'))
                    .setTimestamp()
                    .setFooter({ text: `ID: ${newMember.id}` })
                    .setColor('Blurple');

                return targetChannel.send({ embeds: [embed] });
                


            } else {
                
                const description = [
                    `Username: @${newMember.user.username}`,
                    `Timeout Until: ${getDiscordTimestamp(newMember.communicationDisabledUntilTimestamp)}`,
                ];

                if (executor) description.push(`Timeout set by: ${executor}`);

                const embed = new EmbedBuilder()
                    .setTitle('Timeout')
                    .setDescription(description.join('\n'))
                    .setTimestamp()
                    .setFooter({ text: `ID: ${newMember.id}` })
                    .setColor('Orange');

                return targetChannel.send({ embeds: [embed] });
                
            }
        }

    }
};

function getDiscordTimestamp (date) {
    return `<t:${Math.floor(new Date(date).getTime() / 1000)}:R>`;
}