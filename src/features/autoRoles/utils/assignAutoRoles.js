import { PermissionFlagsBits } from 'discord.js';
import Auto_Roles_Cache from '../cache/autoRoles.cache.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * Splits a server's auto roles into the ones the bot can give right now and the ones it can't
 * (deleted, managed by an integration, or at/above the bot's highest role).
 * Pure apart from reading the guild's caches, so it can be unit-tested.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string[]} roleIds
 * @returns {{ usable: string[], unusable: string[] }}
 */
export function splitAssignableRoles(guild, roleIds) {
    const highest = guild.members.me?.roles.highest.position ?? 0;
    const usable = [];
    const unusable = [];
    for (const id of roleIds) {
        const role = guild.roles.cache.get(id);
        if (role && !role.managed && role.id !== guild.id && role.position < highest) usable.push(id);
        else unusable.push(id);
    }
    return { usable, unusable };
}

/**
 * Gives a new member the server's auto roles: the bot roles for bots, the member roles for people.
 * Roles the bot can no longer give are skipped (and logged), so one bad role doesn't block the rest.
 *
 * @param {import('discord.js').GuildMember} member
 * @returns {Promise<string[]>} The role IDs that were given
 */
export async function assignAutoRoles(member) {
    const { guild } = member;
    const config = await Auto_Roles_Cache.get(guild.id);
    if (!config.enabled) return [];

    const wanted = (member.user.bot ? config.botRoleIds : config.humanRoleIds) ?? [];
    const missing = wanted.filter((id) => !member.roles.cache.has(id));
    if (missing.length === 0) return [];

    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        LogData('Auto Roles', `Guild: ${guild.name} | Missing the Manage Roles permission`, 'warning');
        return [];
    }

    const { usable, unusable } = splitAssignableRoles(guild, missing);
    if (unusable.length > 0) {
        LogData(
            'Auto Roles',
            `Guild: ${guild.name} | Skipped roles the bot can't give (deleted, managed or above its highest role): ${unusable.join(', ')}`,
            'warning'
        );
    }
    if (usable.length === 0) return [];

    try {
        await member.roles.add(usable, 'Auto roles');
        return usable;
    } catch (error) {
        LogData('Auto Roles', `Guild: ${guild.name} | Could not give roles to ${member.id}: ${error.message}`, 'error');
        return [];
    }
}
