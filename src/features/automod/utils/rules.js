import {
    AutoModerationActionType,
    AutoModerationRuleEventType,
    AutoModerationRuleKeywordPresetType,
    AutoModerationRuleTriggerType,
    DiscordAPIError,
    PermissionFlagsBits,
} from 'discord.js';

/**
 * Ovx's AutoMod rules in Discord, one per filter. Named "Ovx · ..." so they're easy to spot under
 * Server Settings > AutoMod.
 */
export const RULE_KEYS = Object.freeze(['spam', 'mentions', 'presets', 'words', 'links']);
const RULE_NAMES = {
    spam: 'Ovx · Spam',
    mentions: 'Ovx · Mass mentions',
    presets: 'Ovx · Word lists',
    words: 'Ovx · Blocked words',
    links: 'Ovx · Links',
};
const FILTER_LABELS = {
    spam: 'Spam',
    mentions: 'Mass mentions',
    presets: "Discord's word lists",
    words: 'Blocked words',
    links: 'Links',
};
/** A link, as Discord's (Rust) regex sees it */
const LINK_PATTERNS = ['https?://\\S+', '(?:^|\\s)www\\.\\S+'];

/**
 * @typedef {import('../models/automodConfig.js').AutomodSettings} AutomodSettings
 * @typedef {{ triggerType: number, triggerMetadata: object, actions: object[] }} RuleSpec
 */

/**
 * The actions a rule takes: always block the message, plus an alert and a timeout when set.
 * @param {AutomodSettings} settings
 * @param {number} [timeoutMinutes] - Only keyword and mention rules can time out (a Discord limit)
 */
function actions(settings, timeoutMinutes = 0) {
    /** @type {{ type: number, metadata: object }[]} */
    const list = [
        {
            type: AutoModerationActionType.BlockMessage,
            metadata: settings.blockMessage ? { customMessage: settings.blockMessage } : {},
        },
    ];
    if (settings.alertChannelId) {
        list.push({ type: AutoModerationActionType.SendAlertMessage, metadata: { channel: settings.alertChannelId } });
    }
    if (timeoutMinutes > 0) {
        list.push({ type: AutoModerationActionType.Timeout, metadata: { durationSeconds: timeoutMinutes * 60 } });
    }
    return list;
}

/**
 * What each of Ovx's rules should be, or null for the ones switched off.
 * @param {AutomodSettings} settings
 * @returns {Record<string, RuleSpec | null>}
 */
export function desiredRules(settings) {
    const presets = [
        settings.presets.profanity && AutoModerationRuleKeywordPresetType.Profanity,
        settings.presets.sexualContent && AutoModerationRuleKeywordPresetType.SexualContent,
        settings.presets.slurs && AutoModerationRuleKeywordPresetType.Slurs,
    ].filter(Boolean);

    return {
        spam: settings.spam.enabled
            ? { triggerType: AutoModerationRuleTriggerType.Spam, triggerMetadata: {}, actions: actions(settings) }
            : null,
        mentions: settings.mentions.enabled
            ? {
                  triggerType: AutoModerationRuleTriggerType.MentionSpam,
                  triggerMetadata: {
                      mentionTotalLimit: settings.mentions.limit,
                      mentionRaidProtectionEnabled: settings.mentions.raidProtection,
                  },
                  actions: actions(settings, settings.mentions.timeoutMinutes),
              }
            : null,
        presets:
            presets.length > 0
                ? {
                      triggerType: AutoModerationRuleTriggerType.KeywordPreset,
                      triggerMetadata: { presets, allowList: settings.words.allowed },
                      actions: actions(settings),
                  }
                : null,
        words: settings.words.enabled
            ? {
                  triggerType: AutoModerationRuleTriggerType.Keyword,
                  triggerMetadata: { keywordFilter: settings.words.keywords, allowList: settings.words.allowed },
                  actions: actions(settings, settings.words.timeoutMinutes),
              }
            : null,
        links: settings.links.enabled
            ? {
                  triggerType: AutoModerationRuleTriggerType.Keyword,
                  triggerMetadata: {
                      regexPatterns: LINK_PATTERNS,
                      allowList: settings.links.allowedSites.map((site) => `*${site}*`),
                  },
                  actions: actions(settings),
              }
            : null,
    };
}

/**
 * Discord's reason for refusing a rule, in words for the dashboard.
 * @param {unknown} error
 */
function refusal(error) {
    if (error instanceof DiscordAPIError) {
        if (error.code === 50013) return 'Ovx is missing the Manage Server permission';
        if (error.code === 30035 || /maximum/i.test(error.message)) {
            return 'the server already has as many AutoMod rules of this kind as Discord allows. Remove one in Server Settings > AutoMod';
        }
        return error.message;
    }
    return error instanceof Error ? error.message : String(error);
}

/**
 * Makes Discord's AutoMod rules match the settings: creates, updates or deletes Ovx's rules. Rules made by
 * hand in Discord aren't touched. One rule failing doesn't stop the others.
 * @param {import('discord.js').Guild} guild
 * @param {AutomodSettings} settings
 * @param {Record<string, string | null>} ruleIds - Ovx's rules from the last save
 * @param {string} reason - For the server's audit log
 * @returns {Promise<{ ruleIds: Record<string, string | null>, problems: string[] }>}
 */
export async function syncRules(guild, settings, ruleIds, reason) {
    const wanted = desiredRules(settings);
    const anyWanted = Object.values(wanted).some(Boolean);
    const anyExisting = Object.values(ruleIds).some(Boolean);
    if (!anyWanted && !anyExisting) return { ruleIds: {}, problems: [] };

    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return { ruleIds, problems: ['Ovx needs the Manage Server permission to set up AutoMod rules.'] };
    }

    const existing = await guild.autoModerationRules.fetch();
    const exemptRoles = settings.exemptRoleIds;
    const exemptChannels = settings.exemptChannelIds;
    /** @type {Record<string, string | null>} */
    const result = {};
    const problems = [];

    for (const key of RULE_KEYS) {
        const spec = wanted[key];
        const rule = ruleIds[key] ? existing.get(ruleIds[key]) : null;
        try {
            if (!spec) {
                if (rule) await rule.delete(reason);
                result[key] = null;
            } else if (rule) {
                await rule.edit({
                    name: RULE_NAMES[key],
                    triggerMetadata: spec.triggerMetadata,
                    actions: /** @type {any} */ (spec.actions),
                    enabled: true,
                    exemptRoles,
                    exemptChannels,
                    reason,
                });
                result[key] = rule.id;
            } else {
                // New, or deleted by hand in Discord since the last save
                const created = await guild.autoModerationRules.create({
                    name: RULE_NAMES[key],
                    eventType: AutoModerationRuleEventType.MessageSend,
                    triggerType: spec.triggerType,
                    triggerMetadata: spec.triggerMetadata,
                    actions: /** @type {any} */ (spec.actions),
                    enabled: true,
                    exemptRoles,
                    exemptChannels,
                    reason,
                });
                result[key] = created.id;
            }
        } catch (error) {
            problems.push(`${FILTER_LABELS[key]}: ${refusal(error)}.`);
            result[key] = rule ? rule.id : null;
        }
    }
    return { ruleIds: result, problems };
}

/**
 * How each of Ovx's rules looks in Discord right now, for the dashboard.
 * @param {import('discord.js').Guild} guild
 * @param {Record<string, string | null>} ruleIds
 * @returns {Promise<{ canManage: boolean, status: Record<string, string>, otherRules: number }>} status: 'active', 'paused' (switched off in Discord), 'missing' (deleted in Discord) or 'off'
 */
export async function ruleStatus(guild, ruleIds) {
    const canManage = Boolean(guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild));
    const status = Object.fromEntries(RULE_KEYS.map((key) => [key, ruleIds[key] ? 'missing' : 'off']));
    if (!canManage) return { canManage, status, otherRules: 0 };

    const rules = await guild.autoModerationRules.fetch().catch(() => null);
    if (!rules) return { canManage, status, otherRules: 0 };
    const ours = new Set(Object.values(ruleIds).filter(Boolean));
    for (const key of RULE_KEYS) {
        const rule = ruleIds[key] ? rules.get(ruleIds[key]) : null;
        if (rule) status[key] = rule.enabled ? 'active' : 'paused';
    }
    return { canManage, status, otherRules: rules.filter((rule) => !ours.has(rule.id)).size };
}
