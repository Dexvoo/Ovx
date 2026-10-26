import User_Levels_Cache from '../cache/userLevels.cache.js';
import { ExpForLevel, LevelForExp } from './levels.js';

/** The most XP that can be given or taken in one go. */
export const ADMIN_XP_MAX = 10_000_000;
const REASON = 'Level changed by an admin';

/**
 * @typedef {'give' | 'take' | 'set-xp' | 'set-level' | 'reset'} AdminOperation
 * @typedef {import('../models/guildLevels.js').GuildLevelsType} GuildLevelsType
 */

/**
 * A member's XP and level after an admin change. XP never goes below 0 or past the server's max level,
 * and the level always matches the XP, the same way it does when XP is earned.
 * @param {{ xp: number, level: number }} current
 * @param {AdminOperation} operation
 * @param {number} amount - XP for give/take/set-xp, a level for set-level, unused for reset
 * @param {number} maxLevel
 * @returns {{ xp: number, level: number }}
 */
export function adminChange(current, operation, amount, maxLevel) {
    const capXP = ExpForLevel(maxLevel);
    let xp;
    if (operation === 'give') xp = current.xp + amount;
    else if (operation === 'take') xp = current.xp - amount;
    else if (operation === 'set-xp') xp = amount;
    else if (operation === 'set-level') xp = ExpForLevel(Math.min(Math.max(0, amount), maxLevel));
    else xp = 0;

    xp = Math.min(Math.max(0, Math.round(xp)), capXP);
    const [level] = LevelForExp(xp);
    return { xp, level: Math.min(level, maxLevel) };
}

/**
 * Makes a member's level reward roles match their level: the reward they've reached is given (and earlier ones
 * removed, if the server removes past rewards), and rewards for levels above theirs are taken away, since
 * an admin can lower a level, which earning XP never does.
 * @param {import('discord.js').GuildMember} member
 * @param {GuildLevelsType} guildData
 * @param {number} level
 * @returns {Promise<{ added: string[], removed: string[], failed: string[] }>} Role IDs
 */
export async function syncRewardRoles(member, guildData, level) {
    const rewards = [...(guildData.rewards ?? [])].filter((reward) => reward?.level && reward?.roleId);
    const top = rewards.filter((reward) => reward.level <= level).sort((a, b) => b.level - a.level)[0] ?? null;
    const result = { added: [], removed: [], failed: [] };

    for (const reward of rewards) {
        const has = member.roles.cache.has(reward.roleId);
        let wanted;
        if (reward.level > level)
            wanted = false; // Not reached (any more)
        else if (reward === top)
            wanted = true; // The reward for their level
        // An earlier reward: removed if the server removes past rewards, otherwise left as it is
        // (earning XP only gives the newest reward, so lower ones they never had aren't handed out either)
        else wanted = guildData.removePastRewards ? false : has;
        if (has === wanted) continue;

        const role = member.guild.roles.cache.get(reward.roleId);
        if (!role) {
            result.failed.push(reward.roleId);
            continue;
        }
        try {
            if (wanted) await member.roles.add(role, REASON);
            else await member.roles.remove(role, REASON);
            (wanted ? result.added : result.removed).push(reward.roleId);
        } catch {
            result.failed.push(reward.roleId);
        }
    }
    return result;
}

/**
 * Changes a member's XP and level, saves it straight away (so /level rank and the leaderboard show it),
 * and optionally syncs their reward roles.
 * @param {import('discord.js').GuildMember} member
 * @param {GuildLevelsType} guildData
 * @param {AdminOperation} operation
 * @param {number} amount
 * @param {{ syncRoles?: boolean }} [options]
 * @returns {Promise<{ before: { xp: number, level: number }, after: { xp: number, level: number },
 *   roles: { added: string[], removed: string[], failed: string[] } } | null>} null if their data couldn't be loaded
 */
export async function applyAdminChange(member, guildData, operation, amount, { syncRoles = true } = {}) {
    const userData = await User_Levels_Cache.get(member.guild.id, member.id);
    if (!userData) return null;

    const before = { xp: userData.xp, level: userData.level };
    const after = adminChange(before, operation, amount, guildData.maxLevel ?? 100);

    if (!(await User_Levels_Cache.setXP(member.guild.id, member.id, after.xp, after.level))) return null;

    const roles = syncRoles
        ? await syncRewardRoles(member, guildData, after.level)
        : { added: [], removed: [], failed: [] };
    return { before, after, roles };
}
