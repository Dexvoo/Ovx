import Automod_Config_Cache from '../cache/automodConfig.cache.js';
import { automodView, validateAutomodSettings, describeAutomodChanges } from './settings.js';
import { syncRules, ruleStatus } from './rules.js';

/**
 * The dashboard's AutoMod page, run on the shard after the Manage Server check (see dashboard/shardHandlers.js).
 * @typedef {{ ok: true, data: any, changes?: string[], action?: string } | { ok: false, status: number, error: string, details?: string[] }} Result
 */

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member - Who is saving, for Discord's audit log
 * @param {{ op: string, settings?: unknown }} payload
 * @param {import('../../../dashboard/validation.js').GuildContext} context
 * @param {{ channel: (id: string) => string, role: (id: string) => string }} names
 * @returns {Promise<Result>}
 */
export async function automodDashboard(guild, member, payload, context, names) {
    const config = await Automod_Config_Cache.get(guild.id);

    if (payload.op === 'get') {
        return { ok: true, data: { ...automodView(config), ...(await ruleStatus(guild, config.ruleIds)) } };
    }
    if (payload.op !== 'save') return { ok: false, status: 400, error: 'Unknown AutoMod action' };

    const { settings, errors } = validateAutomodSettings(payload.settings, context);
    if (!settings) return { ok: false, status: 400, error: 'Some settings are not valid', details: errors };

    const { ruleIds, problems } = await syncRules(
        guild,
        settings.automod,
        config.ruleIds,
        `Changed on the Ovx dashboard by @${member.user.username}`
    );
    const saved = await Automod_Config_Cache.set(guild.id, { ...settings, ruleIds });
    const view = automodView(saved);

    return {
        ok: true,
        data: { ...view, ...(await ruleStatus(guild, ruleIds)), problems },
        changes: describeAutomodChanges(automodView(config), view, names),
        action: 'Updated AutoMod',
    };
}
