import { PermissionFlagsBits } from 'discord.js';
import { ReactionRolePanel } from '../models/reactionRolePanel.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const REASON = 'Reaction role panel';

/**
 * @typedef {{ key: string, vars?: Record<string, string | number> }} Outcome - A translation key under reactionRoles.click
 */

/**
 * Whether Ovx can give a role: it has Manage Roles, and the role is below its own and not managed.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Role} role
 */
export function canGive(guild, role) {
    const me = guild.members.me;
    return Boolean(
        me?.permissions.has(PermissionFlagsBits.ManageRoles) &&
        !role.managed &&
        role.position < me.roles.highest.position
    );
}

/**
 * Gives or removes a panel's role for the member who clicked, following the panel's mode.
 * @param {import('discord.js').GuildMember} member
 * @param {string} panelId
 * @param {string} roleId
 * @returns {Promise<Outcome>}
 */
export async function toggleRole(member, panelId, roleId) {
    const { guild } = member;
    if (!OBJECT_ID.test(panelId)) return { key: 'gone' };

    const panel = await ReactionRolePanel.findOne({ _id: panelId, guildId: guild.id }).lean();
    if (!panel || !panel.buttons.some((button) => button.roleId === roleId)) return { key: 'gone' };

    if (panel.requiredRoleId && !member.roles.cache.has(panel.requiredRoleId)) {
        return { key: 'need_role', vars: { role: `<@&${panel.requiredRoleId}>` } };
    }

    const role = guild.roles.cache.get(roleId);
    if (!role) return { key: 'role_missing' };
    if (!canGive(guild, role)) return { key: 'cannot_give', vars: { role: `${role}` } };

    const panelRoleIds = panel.buttons.map((button) => button.roleId);
    const held = panelRoleIds.filter((id) => member.roles.cache.has(id));

    if (member.roles.cache.has(roleId)) {
        if (panel.mode === 'verify') return { key: 'already', vars: { role: `${role}` } };
        await member.roles.remove(role, REASON);
        return { key: 'removed', vars: { role: `${role}` } };
    }

    if (panel.mode === 'normal' && panel.maxRoles > 0 && held.length >= panel.maxRoles) {
        return { key: 'max', vars: { count: panel.maxRoles } };
    }

    if (panel.mode === 'unique') {
        // Only roles Ovx can actually remove; one it can't stays, rather than failing the whole click
        const others = held.map((id) => guild.roles.cache.get(id)).filter((other) => other && canGive(guild, other));
        if (others.length > 0) {
            await member.roles.remove(others, REASON);
            await member.roles.add(role, REASON);
            return { key: 'swapped', vars: { role: `${role}`, removed: others.map((other) => `${other}`).join(', ') } };
        }
    }

    await member.roles.add(role, REASON);
    return { key: 'added', vars: { role: `${role}` } };
}
