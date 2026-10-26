import { AutoMessage, StickyMessage } from '../models/autoMessages.js';
import { forgetStickies, repostSticky } from './messages.js';
import { cleanText } from '../../../dashboard/validation.js';

export const AUTO_MESSAGE_LIMITS = Object.freeze({
    AUTO_MAX: 10,
    STICKY_MAX: 10,
    CONTENT_MAX: 2000,
    INTERVAL_MIN: 10,
    INTERVAL_MAX: 7 * 24 * 60,
});
const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * The dashboard's Auto Messages page, run on the shard after the Manage Server check (see dashboard/shardHandlers.js).
 * @typedef {{ ok: true, data: any, changes?: string[], action?: string } | { ok: false, status: number, error: string, details?: string[] }} Result
 */

/**
 * Deletes a message Ovx posted, if it's still there.
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @param {string} messageId
 */
async function deletePosted(guild, channelId, messageId) {
    const channel = guild.channels.cache.get(channelId);
    if (channel?.isTextBased()) await channel.messages.delete(messageId).catch(() => {});
}

/** "every 2 hours", "every 30 minutes" */
function every(minutes) {
    if (minutes % 1440 === 0) return `every ${minutes / 1440} day${minutes === 1440 ? '' : 's'}`;
    if (minutes % 60 === 0) return `every ${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
    return `every ${minutes} minutes`;
}

/**
 * @param {import('discord.js').Guild} guild
 */
async function listView(guild) {
    const [autos, stickies] = await Promise.all([
        AutoMessage.find({ guildId: guild.id }).lean(),
        StickyMessage.find({ guildId: guild.id }).lean(),
    ]);
    return {
        autoMessages: autos.map((message) => ({
            id: String(message._id),
            channelId: message.channelId,
            content: message.content,
            intervalMinutes: message.intervalMinutes,
            enabled: message.enabled,
            skipIfQuiet: message.skipIfQuiet,
            nextRunAt: new Date(message.nextRunAt).toISOString(),
        })),
        stickies: stickies.map((sticky) => ({
            id: String(sticky._id),
            channelId: sticky.channelId,
            content: sticky.content,
        })),
    };
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {{ op: string, id?: unknown, message?: any }} payload
 * @param {import('../../../dashboard/validation.js').GuildContext} context
 * @returns {Promise<Result>}
 */
export async function autoMessagesDashboard(guild, payload, context) {
    const { op } = payload;
    const L = AUTO_MESSAGE_LIMITS;
    const channelName = (id) => `#${guild.channels.cache.get(id)?.name ?? 'deleted-channel'}`;
    const id = typeof payload.id === 'string' && OBJECT_ID.test(payload.id) ? payload.id : null;
    const done = async (changes, action) => ({
        ok: /** @type {true} */ (true),
        data: await listView(guild),
        changes,
        action,
    });

    if (op === 'list') return { ok: true, data: await listView(guild) };

    if (op === 'saveAuto' || op === 'saveSticky') {
        const errors = [];
        const input = payload.message && typeof payload.message === 'object' ? payload.message : {};
        if (!context.textChannelIds.has(input.channelId)) errors.push('Choose a text channel Ovx can post in.');
        const content = cleanText(input.content ?? null, 'The message', L.CONTENT_MAX, { multiline: true }, errors);
        if (!content) errors.push('Write the message.');

        if (op === 'saveAuto') {
            const intervalMinutes = Number(input.intervalMinutes);
            if (
                !Number.isInteger(intervalMinutes) ||
                intervalMinutes < L.INTERVAL_MIN ||
                intervalMinutes > L.INTERVAL_MAX
            ) {
                errors.push(`Post it between every ${L.INTERVAL_MIN} minutes and every 7 days.`);
            }
            if (errors.length) return { ok: false, status: 400, error: 'Some details are not valid', details: errors };
            const fields = {
                channelId: input.channelId,
                content,
                intervalMinutes,
                enabled: input.enabled !== false,
                skipIfQuiet: input.skipIfQuiet !== false,
            };
            if (id) {
                // A new interval starts counting from now
                const updated = await AutoMessage.updateOne(
                    { _id: id, guildId: guild.id },
                    { $set: { ...fields, nextRunAt: new Date(Date.now() + intervalMinutes * 60_000) } }
                );
                if (!updated.matchedCount)
                    return { ok: false, status: 404, error: 'That auto message no longer exists' };
                return done(
                    [`${channelName(fields.channelId)}, ${every(intervalMinutes)}${fields.enabled ? '' : ' (off)'}`],
                    'Updated an auto message'
                );
            }
            if ((await AutoMessage.countDocuments({ guildId: guild.id })) >= L.AUTO_MAX) {
                return { ok: false, status: 400, error: `A server can have at most ${L.AUTO_MAX} auto messages.` };
            }
            await AutoMessage.create({
                guildId: guild.id,
                ...fields,
                nextRunAt: new Date(Date.now() + intervalMinutes * 60_000),
            });
            return done([`${channelName(fields.channelId)}, ${every(intervalMinutes)}`], 'Added an auto message');
        }

        if (errors.length) return { ok: false, status: 400, error: 'Some details are not valid', details: errors };
        const existing = await StickyMessage.findOne({ guildId: guild.id, channelId: input.channelId }).lean();
        if (!existing && (await StickyMessage.countDocuments({ guildId: guild.id })) >= L.STICKY_MAX) {
            return { ok: false, status: 400, error: `A server can have at most ${L.STICKY_MAX} sticky messages.` };
        }
        await StickyMessage.updateOne(
            { channelId: input.channelId },
            { $set: { guildId: guild.id, content }, $setOnInsert: { lastMessageId: null } },
            { upsert: true }
        );
        forgetStickies(guild.id);
        // Shown at the bottom straight away (replacing the old copy if it was edited)
        if (existing?.lastMessageId) {
            await deletePosted(guild, input.channelId, existing.lastMessageId);
            await StickyMessage.updateOne({ channelId: input.channelId }, { $set: { lastMessageId: null } });
            forgetStickies(guild.id);
        }
        await repostSticky(guild, input.channelId);
        return done(
            [`${channelName(input.channelId)}`],
            existing ? 'Updated a sticky message' : 'Added a sticky message'
        );
    }

    if (op === 'deleteAuto') {
        const removed = id ? await AutoMessage.findOneAndDelete({ _id: id, guildId: guild.id }).lean() : null;
        if (!removed) return { ok: false, status: 404, error: 'That auto message no longer exists' };
        return done(
            [`${channelName(removed.channelId)}, ${every(removed.intervalMinutes)}`],
            'Deleted an auto message'
        );
    }

    if (op === 'deleteSticky') {
        const removed = id ? await StickyMessage.findOneAndDelete({ _id: id, guildId: guild.id }).lean() : null;
        if (!removed) return { ok: false, status: 404, error: 'That sticky message no longer exists' };
        forgetStickies(guild.id);
        if (removed.lastMessageId) await deletePosted(guild, removed.channelId, removed.lastMessageId);
        return done([`${channelName(removed.channelId)}`], 'Deleted a sticky message');
    }

    return { ok: false, status: 400, error: 'Unknown auto messages action' };
}
