import { LegacyReactionRoles } from '../models/reactionRolePanel.js';
import { canGive } from './assign.js';

/** Dropdowns from the old Ovx bot: `select-role.<messageId>` */
export const LEGACY_SELECT_PREFIX = 'select-role.';
const REASON = 'Reaction role panel';

/**
 * The old dropdown panels: the roles picked in the menu are given, the panel's other roles removed.
 * @param {import('discord.js').StringSelectMenuInteraction<'cached'>} interaction
 * @returns {Promise<import('./assign.js').Outcome>}
 */
export async function legacySelect(interaction) {
    const { guild, member, values } = interaction;
    const messageId = interaction.customId.slice(LEGACY_SELECT_PREFIX.length);
    const panel = await LegacyReactionRoles.findOne({ guildId: guild.id, messageId }).lean();
    if (!panel) return { key: 'gone' };

    const wanted = new Set(values);
    const add = [];
    const remove = [];
    for (const { roleId } of panel.roles) {
        const role = guild.roles.cache.get(roleId);
        if (!role || !canGive(guild, role)) continue;
        if (wanted.has(roleId) && !member.roles.cache.has(roleId)) add.push(role);
        if (!wanted.has(roleId) && member.roles.cache.has(roleId)) remove.push(role);
    }
    if (add.length === 0 && remove.length === 0) return { key: 'unchanged' };

    if (remove.length > 0) await member.roles.remove(remove, REASON);
    if (add.length > 0) await member.roles.add(add, REASON);
    return { key: 'updated' };
}
