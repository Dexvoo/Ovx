import { ShardClientUtil } from 'discord.js';
import { GuildDeparture } from '../models/guildDeparture.js';
import { GuildSettings } from '../../../shared/models/guildSettings.js';
import { AutoRoles } from '../../autoRoles/models/autoRoles.js';
import { LevelConfig } from '../../levels/models/guildLevels.js';
import { UserLevels } from '../../levels/models/userLevels.js';
import { LogsConfig } from '../../logging/models/logging.js';
import { ModCase, ModCaseCounter } from '../../moderation/models/modCase.js';
import { ModerationConfig } from '../../moderation/models/moderationConfig.js';
import { StreamSubscription } from '../../streams/models/streamSubscription.js';
import { Ticket } from '../../tickets/models/ticket.js';
import { TicketConfig } from '../../tickets/models/ticketConfig.js';
import { Welcome } from '../../welcome/models/welcome.js';
import { Giveaway, GiveawayEntry, GiveawayConfig } from '../../giveaways/models/giveaway.js';
import { ReactionRolePanel, LegacyReactionRoles } from '../../reactionRoles/models/reactionRolePanel.js';
import { InviteConfig } from '../../inviteBlocker/models/inviteConfig.js';
import { CustomMessage } from '../../customEmbeds/models/customMessage.js';
import { StarboardConfig, StarboardPost } from '../../starboard/models/starboard.js';
import { AutomodConfig } from '../../automod/models/automodConfig.js';
import { TempVoiceConfig, TempChannel } from '../../tempVoice/models/tempVoice.js';
import { Suggestion, SuggestionCounter, SuggestionConfig } from '../../suggestions/models/suggestion.js';
import { VerificationConfig } from '../../verification/models/verification.js';
import { CommandSettings } from '../../commandSettings/models/commandSettings.js';
import { ServerStats } from '../../serverStats/models/serverStats.js';
import { AutoMessage, StickyMessage } from '../../autoMessages/models/autoMessages.js';
import { TempBan, ChannelLock } from '../../moderation/models/moderationTimers.js';
import { UsageDay } from '../../usage/models/usageDay.js';
import { AuditLog } from '../../../dashboard/models/auditLog.js';
import { LogData } from '../../../shared/utils/logger.js';

/** How long a server's data is kept after Ovx is removed from it (stated in the Privacy Policy). */
export const DATA_RETENTION_DAYS = 30;
const RETENTION_MS = DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** How often each shard deletes the data of servers that have been gone long enough. */
export const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Every collection with a guildId. GuildSettings is handled separately, because of premium.
 * A new per-server model must be added here, or its data is never deleted (a test checks this).
 * @type {import('mongoose').Model<any>[]}
 */
export const GUILD_DATA_MODELS = [
    AutoRoles,
    LevelConfig,
    UserLevels,
    LogsConfig,
    ModCase,
    ModCaseCounter,
    ModerationConfig,
    StreamSubscription,
    Ticket,
    TicketConfig,
    Welcome,
    Giveaway,
    GiveawayEntry,
    GiveawayConfig,
    ReactionRolePanel,
    LegacyReactionRoles,
    InviteConfig,
    CustomMessage,
    StarboardConfig,
    StarboardPost,
    AutomodConfig,
    TempVoiceConfig,
    TempChannel,
    Suggestion,
    SuggestionCounter,
    SuggestionConfig,
    VerificationConfig,
    CommandSettings,
    ServerStats,
    AutoMessage,
    StickyMessage,
    TempBan,
    ChannelLock,
    AuditLog,
];

/**
 * Starts the 30 days for a server Ovx was removed from. Keeps the earliest date if it's already marked.
 * @param {string} guildId
 * @param {Date} [leftAt]
 */
export async function markGuildLeft(guildId, leftAt = new Date()) {
    await GuildDeparture.updateOne({ guildId }, { $min: { leftAt } }, { upsert: true });
}

/**
 * Keeps the data of servers Ovx is in (again).
 * @param {string[]} guildIds
 */
export async function markGuildsPresent(guildIds) {
    if (guildIds.length === 0) return;
    await GuildDeparture.deleteMany({ guildId: { $in: guildIds } });
}

/**
 * Deletes everything Ovx stores about a server. Active premium is kept (so a server that comes back
 * still has what it was given), with its other bot settings cleared.
 * @param {string} guildId
 * @param {Date} [now]
 * @returns {Promise<number>} How many documents were deleted
 */
export async function deleteGuildData(guildId, now = new Date()) {
    const results = await Promise.all(GUILD_DATA_MODELS.map((model) => model.deleteMany({ guildId })));
    let deleted = results.reduce((total, result) => total + (result?.deletedCount ?? 0), 0);

    const settings = await GuildSettings.deleteOne({
        guildId,
        $or: [{ premiumUntil: null }, { premiumUntil: { $lte: now } }],
    });
    deleted += settings?.deletedCount ?? 0;
    if (!settings?.deletedCount) {
        await GuildSettings.updateOne({ guildId }, { $set: { embedColour: null, bio: null } });
    }

    // The developer usage page keeps which servers used a command each day: this one is taken out
    await UsageDay.updateMany({ guilds: guildId }, { $pull: { guilds: guildId } });
    await GuildDeparture.deleteOne({ guildId });
    return deleted;
}

/**
 * Whether a server is handled by one of this process's shards.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 */
export function isOnThisShard(client, guildId) {
    if (!client.shard) return true;
    return client.shard.ids.includes(ShardClientUtil.shardIdForGuildId(guildId, client.shard.count));
}

/**
 * On startup: unmarks servers Ovx is in, and marks servers that removed Ovx while it was offline
 * (no guildDelete event arrives for those). Only this shard's servers are touched.
 * @param {import('discord.js').Client} client
 * @returns {Promise<number>} How many servers were newly found to be gone
 */
export async function reconcileGuilds(client) {
    const present = [...client.guilds.cache.keys()];
    // An empty cache means something is wrong (or a brand new bot), not that every server left
    if (present.length === 0) return 0;
    await markGuildsPresent(present);

    const presentSet = new Set(present);
    const marked = new Set(await GuildDeparture.distinct('guildId'));
    const stored = new Set();
    for (const model of /** @type {import('mongoose').Model<any>[]} */ ([GuildSettings, ...GUILD_DATA_MODELS])) {
        for (const guildId of await model.distinct('guildId')) stored.add(guildId);
    }

    const gone = [...stored].filter(
        (guildId) => !presentSet.has(guildId) && !marked.has(guildId) && isOnThisShard(client, guildId)
    );
    const leftAt = new Date();
    for (const guildId of gone) await markGuildLeft(guildId, leftAt);
    return gone.length;
}

/**
 * Deletes the data of this shard's servers that have been gone for DATA_RETENTION_DAYS.
 * Servers Ovx is in are unmarked first, so a mistaken mark (say, from another bot sharing the
 * database) is cleared before it can delete anything.
 * @param {import('discord.js').Client} client
 * @param {Date} [now]
 * @returns {Promise<string[]>} The servers whose data was deleted
 */
export async function sweepDepartedGuilds(client, now = new Date()) {
    await markGuildsPresent([...client.guilds.cache.keys()]);

    const due = await GuildDeparture.find({ leftAt: { $lte: new Date(now.getTime() - RETENTION_MS) } }).lean();
    const deletedFor = [];
    for (const { guildId } of due) {
        if (!isOnThisShard(client, guildId) || client.guilds.cache.has(guildId)) continue;
        const deleted = await deleteGuildData(guildId, now);
        deletedFor.push(guildId);
        LogData(
            'Data Retention',
            `Deleted ${deleted} record(s) for server ${guildId}, gone ${DATA_RETENTION_DAYS}+ days`,
            'info'
        );
    }
    return deletedFor;
}
