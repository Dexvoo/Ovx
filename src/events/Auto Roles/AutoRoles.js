const { Events, EmbedBuilder, Colors, GuildMember, PermissionFlagsBits } = require('discord.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const { AutoRoles } = require('../../models/GuildSetups');
const { DisabledFeatures } = require('../../utils/Embeds.js');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    nickname: 'Auto Roles',

    /**
     * @param {GuildMember} member
     */
    async execute(member) {
        const { guild, client } = member;

        try {
            const autoRolesData = await AutoRoles.findOne({ guildId: guild.id });
            if (!autoRolesData || !autoRolesData.enabled || !autoRolesData.roles.length) {
                return cleanConsoleLogData('Auto Roles', `Guild: ${guild.name} | Disabled or No Roles Configured`, 'warning');
            }

            const roles = autoRolesData.roles
            const rolesToAdd = roles.filter(roleId => !member.roles.cache.has(roleId));

            if (!rolesToAdd.length) {
                return cleanConsoleLogData('Auto Roles', `Guild: ${guild.name} | No Roles to Add`, 'info');
            }

            const rolesAdded = [];
            for (const roleId of rolesToAdd) {
                const role = guild.roles.cache.get(roleId);
                if (!role) {
                    // remove the role from the auto roles list if it no longer exists
                    autoRolesData.roles = autoRolesData.roles.filter(r => r.roleId !== roleId);
                    await autoRolesData.save();
                    continue;
                }

                if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles) || role.position >= guild.members.me.roles.highest.position) {
                    console.warn(`Auto Roles | Guild: ${guild.name} | Missing Permissions or Role Hierarchy Issue: ${role.name}`);
                    
                    autoRolesData.roles = autoRolesData.roles.filter(r => r.roleId !== roleId);
                    autoRolesData.enabled = false;
                    await autoRolesData.save();

                    const guildOwner = await guild.fetchOwner();
                    if (guildOwner) {
                        DisabledFeatures(client, guildOwner, 'Channel Logs', `Missing Permissions: \`ManageRoles or Hierarchy\``);
                    }
                    return;
                }

                await member.roles.add(role);
                rolesAdded.push(role);
            }

            if (rolesAdded.length) {
                console.log(`Auto Roles | Guild: ${guild.name} | Roles added to member: ${member.user.tag} | Roles: ${rolesAdded.map(r => r.name).join(', ')}`);
            } else {
                cleanConsoleLogData('Auto Roles', `Guild: ${guild.name} | No Roles Added`, 'warning');
            }
        } catch (error) {
            console.error(`Auto Roles | Error processing auto roles for ${member.user.tag}: ${error}`);
        }
    }
};
