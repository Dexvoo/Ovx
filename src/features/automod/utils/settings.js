import { cleanText } from '../../../dashboard/validation.js';

/** Discord's AutoMod limits, plus Ovx's own for anti-raid. */
export const AUTOMOD_LIMITS = Object.freeze({
    KEYWORDS_MAX: 1000,
    KEYWORD_LENGTH: 60,
    ALLOWED_MAX: 100,
    SITES_MAX: 90, // Shares the 100 allowed entries with Discord's invite-style variants
    EXEMPT_ROLES_MAX: 20,
    EXEMPT_CHANNELS_MAX: 50,
    BLOCK_MESSAGE_MAX: 150,
    MENTION_LIMIT_MAX: 50,
    TIMEOUT_MINUTES_MAX: 40_320, // 28 days, Discord's longest timeout
    RAID_JOINS_MIN: 3,
    RAID_JOINS_MAX: 100,
    RAID_SECONDS_MIN: 5,
    RAID_SECONDS_MAX: 600,
    PAUSE_HOURS_MAX: 24, // Discord pauses invites for at most a day
    ACCOUNT_DAYS_MAX: 365,
});

const RAID_ACTIONS = ['alert', 'timeout', 'kick'];
const SITE = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,}$/;

/**
 * @param {import('../models/automodConfig.js').AutomodConfigType} config
 */
export function automodView(config) {
    return { automod: structuredClone(config.automod), raid: { ...config.raid } };
}

/**
 * A list of words or sites from the dashboard: trimmed, lower-cased (Discord matches without case anyway),
 * empty lines and repeats dropped.
 * @param {unknown} value
 */
function cleanList(value) {
    if (!Array.isArray(value)) return null;
    return [
        ...new Set(
            value
                .filter((item) => typeof item === 'string')
                .map((item) => item.trim().toLowerCase())
                .filter(Boolean)
        ),
    ];
}

/**
 * Checks the AutoMod page's settings.
 * @param {unknown} input
 * @param {import('../../../dashboard/validation.js').GuildContext} guild
 */
export function validateAutomodSettings(input, guild) {
    const errors = [];
    const data = input && typeof input === 'object' ? /** @type {any} */ (input) : {};
    const a = data.automod && typeof data.automod === 'object' ? data.automod : {};
    const r = data.raid && typeof data.raid === 'object' ? data.raid : {};
    const L = AUTOMOD_LIMITS;
    const bool = (value, label) => {
        if (typeof value !== 'boolean') errors.push(`${label} must be on or off`);
        return value === true;
    };
    const int = (value, min, max, label) => {
        const number = Number(value);
        if (!Number.isInteger(number) || number < min || number > max) {
            errors.push(`${label} must be a whole number from ${min} to ${max}`);
            return min;
        }
        return number;
    };

    const alertChannelId = a.alertChannelId || null;
    if (alertChannelId && !guild.textChannelIds.has(alertChannelId))
        errors.push('Choose an alert channel Ovx can post in.');

    const exemptRoleIds = cleanList(a.exemptRoleIds) ?? [];
    if (exemptRoleIds.length > L.EXEMPT_ROLES_MAX) errors.push(`Choose at most ${L.EXEMPT_ROLES_MAX} exempt roles.`);
    if (exemptRoleIds.some((id) => !guild.roles.has(id))) errors.push('One of the exempt roles no longer exists.');
    const exemptChannelIds = cleanList(a.exemptChannelIds) ?? [];
    if (exemptChannelIds.length > L.EXEMPT_CHANNELS_MAX)
        errors.push(`Choose at most ${L.EXEMPT_CHANNELS_MAX} exempt channels.`);
    if (exemptChannelIds.some((id) => !guild.channelIds.has(id)))
        errors.push('One of the exempt channels no longer exists.');

    const blockMessage =
        cleanText(a.blockMessage ?? null, 'The block message', L.BLOCK_MESSAGE_MAX, { multiline: false }, errors) ??
        null;

    const keywords = cleanList(a.words?.keywords) ?? [];
    if (keywords.length > L.KEYWORDS_MAX) errors.push(`Blocked words: at most ${L.KEYWORDS_MAX}.`);
    const tooLong = keywords.find((word) => word.length > L.KEYWORD_LENGTH);
    if (tooLong)
        errors.push(`Blocked words can be at most ${L.KEYWORD_LENGTH} characters ("${tooLong.slice(0, 20)}…").`);
    const allowed = cleanList(a.words?.allowed) ?? [];
    if (allowed.length > L.ALLOWED_MAX) errors.push(`Allowed words: at most ${L.ALLOWED_MAX}.`);
    if (allowed.some((word) => word.length > L.KEYWORD_LENGTH))
        errors.push(`Allowed words can be at most ${L.KEYWORD_LENGTH} characters.`);
    const wordsEnabled = bool(a.words?.enabled, 'Blocked words');
    if (wordsEnabled && keywords.length === 0)
        errors.push('Add at least one blocked word, or switch blocked words off.');

    const allowedSites = (cleanList(a.links?.allowedSites) ?? []).map((site) =>
        site
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/.*$/, '')
    );
    if (allowedSites.length > L.SITES_MAX) errors.push(`Allowed sites: at most ${L.SITES_MAX}.`);
    const badSite = allowedSites.find((site) => !SITE.test(site));
    if (badSite) errors.push(`"${badSite.slice(0, 40)}" is not a website address, like youtube.com.`);

    const automod = {
        alertChannelId,
        exemptRoleIds,
        exemptChannelIds,
        blockMessage,
        spam: { enabled: bool(a.spam?.enabled, 'Spam') },
        mentions: {
            enabled: bool(a.mentions?.enabled, 'Mass mentions'),
            limit: int(a.mentions?.limit ?? 5, 1, L.MENTION_LIMIT_MAX, 'The mention limit'),
            raidProtection: bool(a.mentions?.raidProtection, 'Mention raid protection'),
            timeoutMinutes: int(a.mentions?.timeoutMinutes ?? 0, 0, L.TIMEOUT_MINUTES_MAX, 'The mention timeout'),
        },
        presets: {
            profanity: bool(a.presets?.profanity, 'Profanity'),
            sexualContent: bool(a.presets?.sexualContent, 'Sexual content'),
            slurs: bool(a.presets?.slurs, 'Slurs'),
        },
        words: {
            enabled: wordsEnabled,
            keywords,
            allowed,
            timeoutMinutes: int(a.words?.timeoutMinutes ?? 0, 0, L.TIMEOUT_MINUTES_MAX, 'The blocked words timeout'),
        },
        links: { enabled: bool(a.links?.enabled, 'Links'), allowedSites: [...new Set(allowedSites)] },
    };

    const pingRoleId = r.pingRoleId || null;
    if (pingRoleId && !guild.roles.has(pingRoleId)) errors.push('The role to ping no longer exists.');
    const action = RAID_ACTIONS.includes(r.action) ? r.action : null;
    if (!action) errors.push('Choose what happens to members who join during a raid.');
    const raid = {
        enabled: bool(r.enabled, 'Anti-raid'),
        joins: int(r.joins ?? 10, L.RAID_JOINS_MIN, L.RAID_JOINS_MAX, 'Joins'),
        seconds: int(r.seconds ?? 30, L.RAID_SECONDS_MIN, L.RAID_SECONDS_MAX, 'Seconds'),
        action: action ?? 'alert',
        pauseInvitesHours: int(r.pauseInvitesHours ?? 0, 0, L.PAUSE_HOURS_MAX, 'Hours to pause invites'),
        pingRoleId,
        minAccountDays: int(r.minAccountDays ?? 0, 0, L.ACCOUNT_DAYS_MAX, 'Minimum account age'),
    };
    if (raid.enabled && !alertChannelId) errors.push('Choose an alert channel, so staff hear about raids.');

    return { settings: errors.length ? null : { automod, raid }, errors };
}

/**
 * What changed, for the Web Logs.
 * @param {ReturnType<typeof automodView>} before
 * @param {ReturnType<typeof automodView>} after
 * @param {{ channel: (id: string) => string, role: (id: string) => string }} names
 */
export function describeAutomodChanges(before, after, names) {
    const onOff = (value) => (value ? 'on' : 'off');
    const changes = [];
    const toggle = (label, was, now) => was !== now && changes.push(`${label}: ${onOff(was)} → ${onOff(now)}`);
    const value = (label, was, now) => was !== now && changes.push(`${label}: ${was} → ${now}`);
    const list = (label, was, now, name = (item) => item) => {
        const added = now.filter((item) => !was.includes(item));
        const removed = was.filter((item) => !now.includes(item));
        if (added.length)
            changes.push(
                `${label} added: ${added.slice(0, 10).map(name).join(', ')}${added.length > 10 ? ` and ${added.length - 10} more` : ''}`
            );
        if (removed.length)
            changes.push(
                `${label} removed: ${removed.slice(0, 10).map(name).join(', ')}${removed.length > 10 ? ` and ${removed.length - 10} more` : ''}`
            );
    };
    const [a, b] = [before.automod, after.automod];

    toggle('Spam filter', a.spam.enabled, b.spam.enabled);
    toggle('Mass mention filter', a.mentions.enabled, b.mentions.enabled);
    value('Mention limit', a.mentions.limit, b.mentions.limit);
    toggle('Mention raid protection', a.mentions.raidProtection, b.mentions.raidProtection);
    value('Mention timeout (minutes)', a.mentions.timeoutMinutes, b.mentions.timeoutMinutes);
    toggle('Profanity list', a.presets.profanity, b.presets.profanity);
    toggle('Sexual content list', a.presets.sexualContent, b.presets.sexualContent);
    toggle('Slurs list', a.presets.slurs, b.presets.slurs);
    toggle('Blocked words', a.words.enabled, b.words.enabled);
    // Blocked words themselves aren't written to the logs, which other staff can read
    if (
        a.words.keywords.length !== b.words.keywords.length ||
        a.words.keywords.some((word, i) => word !== b.words.keywords[i])
    ) {
        changes.push(`Blocked words list changed (${a.words.keywords.length} → ${b.words.keywords.length} words)`);
    }
    list('Allowed words', a.words.allowed, b.words.allowed);
    value('Blocked words timeout (minutes)', a.words.timeoutMinutes, b.words.timeoutMinutes);
    toggle('Link filter', a.links.enabled, b.links.enabled);
    list('Allowed sites', a.links.allowedSites, b.links.allowedSites);
    value('Alert channel', names.channel(a.alertChannelId), names.channel(b.alertChannelId));
    list('Exempt roles', a.exemptRoleIds, b.exemptRoleIds, names.role);
    list('Exempt channels', a.exemptChannelIds, b.exemptChannelIds, names.channel);
    if (a.blockMessage !== b.blockMessage) changes.push('Block message changed');

    const [r, s] = [before.raid, after.raid];
    toggle('Anti-raid', r.enabled, s.enabled);
    value('Raid threshold', `${r.joins} joins in ${r.seconds}s`, `${s.joins} joins in ${s.seconds}s`);
    value('Raid action', r.action, s.action);
    value('Pause invites (hours)', r.pauseInvitesHours, s.pauseInvitesHours);
    value(
        'Raid ping role',
        r.pingRoleId ? names.role(r.pingRoleId) : 'none',
        s.pingRoleId ? names.role(s.pingRoleId) : 'none'
    );
    value('Minimum account age (days)', r.minAccountDays, s.minAccountDays);
    return changes;
}
