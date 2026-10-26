import { Giveaway, GiveawayEntry } from '../models/giveaway.js';
import { refreshMessage } from './lifecycle.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * Giveaways from the old Ovx bot. Its model ('Guild-Giveaways') and this one ('Guild-Giveaway') share the
 * MongoDB collection 'guild-giveaways', so its documents show up here in its own shape:
 * { guildId, messageId, channelId, prize, endsAt, winnerCount, hostId, requiredRoleId, entrants: [userId],
 *   winners, isActive, createdAt, updatedAt } (no `status`).
 */

/** Old Enter buttons: `giveaway-enter.<messageId>` */
export const LEGACY_ENTER_PREFIX = 'giveaway-enter.';

/**
 * The new shape of an old giveaway. One whose end time passed while Ovx was offline is left running,
 * so the timer ends it and draws winners from its entrants as normal.
 * @param {any} old - A raw document from the old bot
 */
export function convertLegacy(old) {
    const endsAt = old.endsAt ? new Date(old.endsAt) : new Date();
    const startsAt = old.createdAt ? new Date(old.createdAt) : endsAt;
    const entrants = Array.isArray(old.entrants)
        ? [...new Set(old.entrants.filter((id) => typeof id === 'string'))]
        : [];
    return {
        set: {
            status: old.isActive ? 'running' : 'ended',
            startsAt,
            endsAt,
            createdBy: old.hostId ?? 'unknown',
            description: null,
            requirements: { roleIds: old.requiredRoleId ? [old.requiredRoleId] : [], minLevel: 0 },
            voteBonus: 0,
            winners: Array.isArray(old.winners) ? old.winners : [],
            entrantCount: entrants.length,
            endedAt: old.isActive ? null : new Date(old.updatedAt ?? endsAt),
        },
        entrants,
    };
}

/**
 * The old collection had a unique index on messageId. New giveaways are saved before they're posted
 * (messageId null), so a second one would break it.
 */
async function dropOldMessageIndex() {
    const indexes = await Giveaway.collection.indexes().catch(() => []);
    const old = indexes.find(
        (index) => index.unique && index.key?.messageId === 1 && Object.keys(index.key).length === 1
    );
    if (old?.name) await Giveaway.collection.dropIndex(old.name).catch(() => {});
}

/**
 * Converts this shard's old giveaways to the new shape, once (converted ones have a status).
 * Raw collection calls are used because the schema would strip the old fields being removed.
 * @param {import('discord.js').Client} client
 * @returns {Promise<number>} How many were converted
 */
export async function migrateLegacyGiveaways(client) {
    await dropOldMessageIndex();
    const guildIds = [...client.guilds.cache.keys()];
    if (guildIds.length === 0) return 0;

    const old = await Giveaway.collection.find({ guildId: { $in: guildIds }, status: { $exists: false } }).toArray();
    for (const doc of old) {
        const { set, entrants } = convertLegacy(doc);
        if (entrants.length > 0) {
            await GiveawayEntry.insertMany(
                entrants.map((userId) => ({ giveawayId: doc._id, guildId: doc.guildId, userId, entries: 1 })),
                { ordered: false }
            ).catch(() => {}); // Some already moved by an interrupted run: the rest are still added
        }
        await Giveaway.collection.updateOne(
            { _id: doc._id },
            { $set: set, $unset: { entrants: '', isActive: '', requiredRoleId: '', updatedAt: '', __v: '' } }
        );

        // Running ones get the new Enter button
        if (set.status === 'running') {
            const guild = client.guilds.cache.get(doc.guildId);
            const converted = await Giveaway.findById(doc._id).lean();
            if (guild && converted) await refreshMessage(guild, converted).catch(() => {});
        }
    }
    if (old.length > 0) LogData('Giveaways', `Converted ${old.length} giveaway(s) from the old Ovx bot`, 'info');
    return old.length;
}
