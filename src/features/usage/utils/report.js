import { UsageDay } from '../models/usageDay.js';
import { dayKey } from './usage.js';
import { GuildDeparture } from '../../dataRetention/models/guildDeparture.js';
import { LevelConfig } from '../../levels/models/guildLevels.js';
import { Welcome } from '../../welcome/models/welcome.js';
import { AutoRoles } from '../../autoRoles/models/autoRoles.js';
import { LogsConfig } from '../../logging/models/logging.js';
import { TicketConfig } from '../../tickets/models/ticketConfig.js';
import { AutomodConfig } from '../../automod/models/automodConfig.js';
import { InviteConfig } from '../../inviteBlocker/models/inviteConfig.js';
import { HoneypotConfig } from '../../honeypot/models/honeypotConfig.js';
import { StarboardConfig } from '../../starboard/models/starboard.js';
import { SuggestionConfig } from '../../suggestions/models/suggestion.js';
import { TempVoiceConfig } from '../../tempVoice/models/tempVoice.js';
import { VerificationConfig } from '../../verification/models/verification.js';
import { ReactionRolePanel } from '../../reactionRoles/models/reactionRolePanel.js';
import { CustomMessage } from '../../customEmbeds/models/customMessage.js';
import { ServerStats } from '../../serverStats/models/serverStats.js';
import { AutoMessage, StickyMessage } from '../../autoMessages/models/autoMessages.js';
import { Giveaway } from '../../giveaways/models/giveaway.js';
import { StreamSubscription } from '../../streams/models/streamSubscription.js';
import { ModerationConfig } from '../../moderation/models/moderationConfig.js';
import { CommandSettings } from '../../commandSettings/models/commandSettings.js';

export const USAGE_WINDOWS = Object.freeze([7, 30, 90]);
const DAY_MS = 86_400_000;
const LOG_TYPES = ['message', 'channel', 'join', 'leave', 'voice', 'role', 'server', 'member', 'punishment'];
const AUTOMOD_FILTERS = ['spam', 'mentions', 'words', 'links'];

/**
 * Each dashboard feature, and which servers count as using it: switched on, or with something set up.
 * @type {{ key: string, label: string, model: import('mongoose').Model<any>, filter: Record<string, any> }[]}
 */
const FEATURES = [
    { key: 'levels', label: 'Levels', model: LevelConfig, filter: { enabled: true } },
    {
        key: 'welcome',
        label: 'Welcome / goodbye',
        model: Welcome,
        filter: { $or: [{ 'welcome.enabled': true }, { 'goodbye.enabled': true }] },
    },
    { key: 'autoRoles', label: 'Auto roles', model: AutoRoles, filter: { enabled: true } },
    {
        key: 'logging',
        label: 'Logging',
        model: LogsConfig,
        filter: { $or: LOG_TYPES.map((type) => ({ [`${type}.enabled`]: true })) },
    },
    { key: 'tickets', label: 'Tickets', model: TicketConfig, filter: { enabled: true } },
    {
        key: 'automod',
        label: 'AutoMod',
        model: AutomodConfig,
        filter: { $or: AUTOMOD_FILTERS.map((name) => ({ [`automod.${name}.enabled`]: true })) },
    },
    { key: 'antiRaid', label: 'Anti-raid', model: AutomodConfig, filter: { 'raid.enabled': true } },
    {
        key: 'warnActions',
        label: 'Automatic warning actions',
        model: ModerationConfig,
        filter: { 'warnActions.0': { $exists: true } },
    },
    { key: 'inviteBlocker', label: 'Invite blocker', model: InviteConfig, filter: { enabled: true } },
    { key: 'honeypot', label: 'Honeypot channel', model: HoneypotConfig, filter: { enabled: true } },
    { key: 'verification', label: 'Verification', model: VerificationConfig, filter: { enabled: true } },
    { key: 'reactionRoles', label: 'Reaction roles', model: ReactionRolePanel, filter: {} },
    { key: 'starboard', label: 'Starboard', model: StarboardConfig, filter: { enabled: true } },
    { key: 'suggestions', label: 'Suggestions', model: SuggestionConfig, filter: { enabled: true } },
    { key: 'tempVoice', label: 'Join to create', model: TempVoiceConfig, filter: { enabled: true } },
    { key: 'serverStats', label: 'Server stats', model: ServerStats, filter: { 'counters.0': { $exists: true } } },
    { key: 'autoMessages', label: 'Auto messages', model: AutoMessage, filter: { enabled: true } },
    { key: 'stickyMessages', label: 'Sticky messages', model: StickyMessage, filter: {} },
    { key: 'customEmbeds', label: 'Custom embeds', model: CustomMessage, filter: {} },
    { key: 'giveaways', label: 'Giveaways (ever run)', model: Giveaway, filter: {} },
    { key: 'streams', label: 'Stream alerts', model: StreamSubscription, filter: {} },
];

/**
 * The developer page's numbers. Servers that removed Ovx (and are waiting to be deleted) aren't counted as
 * using a feature.
 * @param {{ days?: number, now?: Date }} [options]
 */
export async function usageReport({ days = 30, now = new Date() } = {}) {
    const window = USAGE_WINDOWS.includes(days) ? days : 30;
    const keys = Array.from({ length: window }, (_, index) =>
        dayKey(new Date(now.getTime() - (window - 1 - index) * DAY_MS))
    );

    const [stored, departed] = await Promise.all([
        UsageDay.find({ day: { $gte: keys[0] } }).lean(),
        GuildDeparture.distinct('guildId'),
    ]);
    const byDay = new Map(stored.map((doc) => [doc.day, doc]));
    const stillHere = { guildId: { $nin: departed } };

    const commandTotals = new Map();
    const activeServers = new Set();
    const daily = keys.map((day) => {
        const doc = byDay.get(day);
        let uses = 0;
        for (const [name, count] of Object.entries(doc?.commands ?? {})) {
            uses += count;
            commandTotals.set(name, (commandTotals.get(name) ?? 0) + count);
        }
        for (const guildId of doc?.guilds ?? []) activeServers.add(guildId);
        return { day, uses, servers: doc?.guilds?.length ?? 0, joins: doc?.joins ?? 0, leaves: doc?.leaves ?? 0 };
    });

    const [features, disabled] = await Promise.all([
        Promise.all(
            FEATURES.map(async ({ key, label, model, filter }) => ({
                key,
                label,
                servers: (await model.distinct('guildId', { ...filter, ...stillHere })).length,
            }))
        ),
        CommandSettings.aggregate([
            { $match: stillHere },
            { $unwind: '$disabled' },
            { $group: { _id: '$disabled', servers: { $sum: 1 } } },
            { $sort: { servers: -1 } },
            { $limit: 15 },
        ]),
    ]);

    return {
        days: window,
        daily,
        totals: {
            uses: daily.reduce((sum, day) => sum + day.uses, 0),
            activeServers: activeServers.size,
            joins: daily.reduce((sum, day) => sum + day.joins, 0),
            leaves: daily.reduce((sum, day) => sum + day.leaves, 0),
        },
        commands: [...commandTotals]
            .map(([name, uses]) => ({ name, uses }))
            .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name)),
        features: features.sort((a, b) => b.servers - a.servers),
        disabledCommands: disabled.map(({ _id, servers }) => ({ name: _id, servers })),
    };
}
