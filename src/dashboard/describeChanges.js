/**
 * Human-readable descriptions of what a dashboard save changed, for the Web Logs.
 * Pure (names are looked up through the functions passed in) so it can be unit-tested.
 *
 * @typedef {{ channel: (id: string | null) => string, role: (id: string) => string }} NameLookup
 */

import { formatDuration } from '../features/moderation/utils/checks.js';

const onOff = (value) => (value ? 'on' : 'off');

/**
 * @param {any} before - levelsView before the save
 * @param {any} after - levelsView after the save
 * @param {NameLookup} names
 * @returns {string[]}
 */
export function describeLevelChanges(before, after, names) {
    const changes = [];
    const changed = (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]);

    if (changed('enabled')) changes.push(`Levels: ${onOff(before.enabled)} → ${onOff(after.enabled)}`);
    if (changed('channelId')) {
        changes.push(`Level-up channel: ${names.channel(before.channelId)} → ${names.channel(after.channelId)}`);
    }
    if (changed('levelUpMessage')) {
        changes.push(after.levelUpMessage ? 'Level-up message changed' : 'Level-up message reset to the default');
    }
    if (changed('messageCooldown')) {
        changes.push(`Message cooldown: ${before.messageCooldown}s → ${after.messageCooldown}s`);
    }
    if (changed('maxLevel')) changes.push(`Max level: ${before.maxLevel} → ${after.maxLevel}`);
    if (changed('removePastRewards')) {
        changes.push(`Remove past rewards: ${onOff(before.removePastRewards)} → ${onOff(after.removePastRewards)}`);
    }
    if (changed('publicLeaderboard')) {
        changes.push(`Public leaderboard: ${onOff(before.publicLeaderboard)} → ${onOff(after.publicLeaderboard)}`);
    }

    // Rewards are compared as "level + role" pairs
    const rewardKey = (reward) => `${reward.level}:${reward.roleId}`;
    const beforeRewards = new Set((before.rewards ?? []).map(rewardKey));
    const afterRewards = new Set((after.rewards ?? []).map(rewardKey));
    for (const reward of after.rewards ?? []) {
        if (!beforeRewards.has(rewardKey(reward))) {
            changes.push(`Added reward: level ${reward.level} → ${names.role(reward.roleId)}`);
        }
    }
    for (const reward of before.rewards ?? []) {
        if (!afterRewards.has(rewardKey(reward))) {
            changes.push(`Removed reward: level ${reward.level} → ${names.role(reward.roleId)}`);
        }
    }

    changes.push(
        ...listChanges('No-XP role', before.blacklisted?.roleIds, after.blacklisted?.roleIds, names.role),
        ...listChanges('No-XP channel', before.blacklisted?.channelIds, after.blacklisted?.channelIds, names.channel)
    );

    return changes;
}

/**
 * @param {any} before - loggingView before the save
 * @param {any} after - loggingView after the save
 * @param {NameLookup} names
 * @returns {string[]}
 */
export function describeLoggingChanges(before, after, names) {
    const changes = [];

    for (const [type, now] of Object.entries(after.types ?? {})) {
        const was = before.types?.[type] ?? { enabled: false, channelId: null };
        const label = `${type.charAt(0).toUpperCase()}${type.slice(1)} logs`;
        if (was.enabled !== now.enabled) changes.push(`${label}: ${onOff(was.enabled)} → ${onOff(now.enabled)}`);
        if (was.channelId !== now.channelId) {
            changes.push(`${label} channel: ${names.channel(was.channelId)} → ${names.channel(now.channelId)}`);
        }
    }

    changes.push(...listChanges('Ignored channel', before.ignoredChannels, after.ignoredChannels, names.channel));
    return changes;
}

/**
 * "Added X" / "Removed X" lines for a list of IDs.
 * @param {string} label
 * @param {string[] | undefined} before
 * @param {string[] | undefined} after
 * @param {(id: string) => string} name
 */
function listChanges(label, before = [], after = [], name) {
    return [
        ...after.filter((id) => !before.includes(id)).map((id) => `Added ${label.toLowerCase()}: ${name(id)}`),
        ...before.filter((id) => !after.includes(id)).map((id) => `Removed ${label.toLowerCase()}: ${name(id)}`),
    ];
}

/**
 * @typedef {Object} BotViewForChanges
 * @property {string} username
 * @property {string | null} nickname
 * @property {string | null} customAvatar - The server avatar, if one is set
 * @property {string | null} banner
 * @property {string | null} bio
 * @property {string | null} embedColour
 */

/**
 * @param {BotViewForChanges} before - botView before the save
 * @param {BotViewForChanges} after - botView after the save
 * @returns {string[]}
 */
export function describeBotChanges(before, after) {
    const changes = [];

    if (before.nickname !== after.nickname) {
        changes.push(
            after.nickname
                ? `Nickname: ${before.nickname ?? `${before.username} (default)`} → ${after.nickname}`
                : `Nickname reset: ${before.nickname} → ${after.username}`
        );
    }
    if (before.customAvatar !== after.customAvatar)
        changes.push(`Avatar ${imageChange(before.customAvatar, after.customAvatar)}`);
    if (before.banner !== after.banner) changes.push(`Banner ${imageChange(before.banner, after.banner)}`);
    if (before.bio !== after.bio) changes.push(after.bio ? 'About Me changed' : 'About Me removed');
    if (before.embedColour !== after.embedColour) {
        changes.push(`Embed colour: ${before.embedColour ?? 'default'} → ${after.embedColour ?? 'default'}`);
    }

    return changes;
}

const imageChange = (before, after) => (!before ? 'added' : !after ? 'removed (back to the default)' : 'changed');

/**
 * @param {{ enabled: boolean, humanRoleIds: string[], botRoleIds: string[] }} before - autoRolesView before the save
 * @param {{ enabled: boolean, humanRoleIds: string[], botRoleIds: string[] }} after - autoRolesView after the save
 * @param {NameLookup} names
 * @returns {string[]}
 */
export function describeAutoRoleChanges(before, after, names) {
    return [
        ...(before.enabled !== after.enabled ? [`Auto roles: ${onOff(before.enabled)} → ${onOff(after.enabled)}`] : []),
        ...listChanges('Role for new members', before.humanRoleIds, after.humanRoleIds, names.role),
        ...listChanges('Role for new bots', before.botRoleIds, after.botRoleIds, names.role),
    ];
}

/**
 * @param {any} before - welcomeView before the save
 * @param {any} after - welcomeView after the save
 * @param {NameLookup} names
 * @returns {string[]}
 */
export function describeWelcomeChanges(before, after, names) {
    const changes = [];
    for (const [kind, label] of [
        ['welcome', 'Welcome'],
        ['goodbye', 'Goodbye'],
    ]) {
        const was = before[kind];
        const now = after[kind];
        if (was.enabled !== now.enabled)
            changes.push(`${label} messages: ${onOff(was.enabled)} → ${onOff(now.enabled)}`);
        if (was.channelId !== now.channelId) {
            changes.push(`${label} channel: ${names.channel(was.channelId)} → ${names.channel(now.channelId)}`);
        }
        if (was.message !== now.message) {
            changes.push(now.message ? `${label} message changed` : `${label} message reset to the default`);
        }
        if (was.embed !== now.embed) changes.push(`${label} embed: ${onOff(was.embed)} → ${onOff(now.embed)}`);
        if (was.title !== now.title)
            changes.push(now.title ? `${label} embed title changed` : `${label} embed title removed`);
    }
    return changes;
}

/**
 * @param {any} before - ticketsView before the save
 * @param {any} after - ticketsView after the save
 * @param {NameLookup} names
 * @returns {string[]}
 */
export function describeTicketChanges(before, after, names) {
    const changes = [];
    const category = (id) => (id ? names.channel(id).replace(/^#/, '') : 'none');
    const toggles = [
        ['enabled', 'Tickets'],
        ['pingStaff', 'Ping staff on new tickets'],
        ['ownerCanClose', 'Members can close their own tickets'],
        ['dmTranscript', 'DM transcripts to members'],
    ];

    for (const [key, label] of toggles) {
        if (before[key] !== after[key]) changes.push(`${label}: ${onOff(before[key])} → ${onOff(after[key])}`);
    }
    if (before.categoryId !== after.categoryId) {
        changes.push(`Ticket category: ${category(before.categoryId)} → ${category(after.categoryId)}`);
    }
    if (before.transcriptChannelId !== after.transcriptChannelId) {
        changes.push(
            `Transcript channel: ${names.channel(before.transcriptChannelId)} → ${names.channel(after.transcriptChannelId)}`
        );
    }
    if (before.maxOpenPerUser !== after.maxOpenPerUser) {
        changes.push(`Open tickets per member: ${before.maxOpenPerUser} → ${after.maxOpenPerUser}`);
    }
    if (before.openMessage !== after.openMessage) {
        changes.push(after.openMessage ? 'Ticket message changed' : 'Ticket message reset to the default');
    }
    for (const [key, label] of [
        ['title', 'Panel title'],
        ['description', 'Panel text'],
        ['buttonLabel', 'Panel button label'],
    ]) {
        if (before.panel[key] !== after.panel[key]) {
            changes.push(after.panel[key] ? `${label} changed` : `${label} reset to the default`);
        }
    }
    changes.push(...listChanges('Staff role', before.staffRoleIds, after.staffRoleIds, names.role));
    changes.push(...describeTicketTypeChanges(before.ticketTypes ?? [], after.ticketTypes ?? []));
    return changes;
}

/**
 * Ticket types are matched by ID, so renaming one counts as a change, not a removal.
 * @param {any[]} before
 * @param {any[]} after
 */
function describeTicketTypeChanges(before, after) {
    const changes = [];
    const beforeById = new Map(before.map((type) => [type.id, type]));
    const afterIds = new Set(after.map((type) => type.id));

    for (const type of after) {
        const was = beforeById.get(type.id);
        if (!was) changes.push(`Added ticket type: ${type.label}`);
        else if (JSON.stringify(was) !== JSON.stringify(type)) {
            changes.push(
                was.label === type.label
                    ? `Changed ticket type: ${type.label}`
                    : `Changed ticket type: ${was.label} → ${type.label}`
            );
        }
    }
    for (const type of before) {
        if (!afterIds.has(type.id)) changes.push(`Removed ticket type: ${type.label}`);
    }

    const order = (types) =>
        types
            .filter((type) => beforeById.has(type.id) && afterIds.has(type.id))
            .map((type) => type.id)
            .join();
    if (order(before) !== order(after)) changes.push('Reordered ticket types');
    return changes;
}

/**
 * Changes to followed streamers.
 * @param {any[]} before - subscriptionView list before the save
 * @param {any[]} after - subscriptionView list after the save
 * @param {NameLookup} names
 * @returns {string[]}
 */
export function describeStreamChanges(before, after, names) {
    const changes = [];
    const platformName = { twitch: 'Twitch', youtube: 'YouTube', kick: 'Kick' };
    const label = (subscription) => `${platformName[subscription.platform]} ${subscription.account.displayName}`;
    const role = (roleId) => (roleId === 'everyone' ? '@everyone' : roleId ? names.role(roleId) : 'no ping');
    const beforeById = new Map(before.map((subscription) => [subscription.id, subscription]));
    const afterIds = new Set(after.map((subscription) => subscription.id));

    for (const subscription of after) {
        const was = beforeById.get(subscription.id);
        if (!was) {
            changes.push(`Followed ${label(subscription)} in ${names.channel(subscription.channelId)}`);
            continue;
        }
        const name = label(subscription);
        if (was.channelId !== subscription.channelId) {
            changes.push(`${name}: channel ${names.channel(was.channelId)} → ${names.channel(subscription.channelId)}`);
        }
        if (was.roleId !== subscription.roleId)
            changes.push(`${name}: ping ${role(was.roleId)} → ${role(subscription.roleId)}`);
        if (was.notifyLive !== subscription.notifyLive) {
            changes.push(`${name}: live notifications ${onOff(was.notifyLive)} → ${onOff(subscription.notifyLive)}`);
        }
        if (was.notifyVideos !== subscription.notifyVideos) {
            changes.push(
                `${name}: video notifications ${onOff(was.notifyVideos)} → ${onOff(subscription.notifyVideos)}`
            );
        }
        if (was.liveMessage !== subscription.liveMessage) changes.push(`${name}: live message changed`);
        if (was.videoMessage !== subscription.videoMessage) changes.push(`${name}: video message changed`);
    }
    for (const subscription of before) {
        if (!afterIds.has(subscription.id)) changes.push(`Unfollowed ${label(subscription)}`);
    }
    return changes;
}

/**
 * @param {{ warnActions: { warnings: number, action: string, durationMs: number | null }[] }} before - moderationView
 * @param {{ warnActions: { warnings: number, action: string, durationMs: number | null }[] }} after - moderationView
 * @returns {string[]}
 */
export function describeModerationChanges(before, after) {
    const describe = (rule) => (rule.action === 'mute' ? `mute for ${formatDuration(rule.durationMs)}` : rule.action);
    const beforeByCount = new Map(before.warnActions.map((rule) => [rule.warnings, rule]));
    const afterByCount = new Map(after.warnActions.map((rule) => [rule.warnings, rule]));
    const changes = [];

    for (const [count, rule] of afterByCount) {
        const was = beforeByCount.get(count);
        if (!was) changes.push(`At ${count} warnings: added ${describe(rule)}`);
        else if (describe(was) !== describe(rule)) {
            changes.push(`At ${count} warnings: ${describe(was)} → ${describe(rule)}`);
        }
    }
    for (const [count, rule] of beforeByCount) {
        if (!afterByCount.has(count)) changes.push(`At ${count} warnings: removed ${describe(rule)}`);
    }
    return changes;
}
