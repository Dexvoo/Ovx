import { CustomMessage } from '../models/customMessage.js';
import { validateCustomMessage, CUSTOM_EMBED_LIMITS } from './validation.js';
import { customMessage } from './message.js';
import { publishMessage, removePostedMessage } from '../../../shared/utils/postedMessage.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * The dashboard's Custom Embeds page, run on the shard after the Manage Server check (see dashboard/shardHandlers.js).
 * @typedef {{ ok: true, data: any, changes?: string[], action?: string } | { ok: false, status: number, error: string, details?: string[] }} Result
 */

/**
 * @param {any} saved - A saved custom message (lean document)
 */
export function customMessageView(saved) {
    return {
        id: String(saved._id),
        name: saved.name,
        channelId: saved.channelId,
        posted: Boolean(saved.messageId),
        messageUrl: saved.messageId
            ? `https://discord.com/channels/${saved.guildId}/${saved.channelId}/${saved.messageId}`
            : null,
        content: saved.content ?? null,
        embed: {
            title: saved.embed?.title ?? null,
            url: saved.embed?.url ?? null,
            description: saved.embed?.description ?? null,
            colour: saved.embed?.colour ?? null,
            author: {
                name: saved.embed?.author?.name ?? null,
                iconUrl: saved.embed?.author?.iconUrl ?? null,
                url: saved.embed?.author?.url ?? null,
            },
            fields: (saved.embed?.fields ?? []).map(({ name, value, inline }) => ({
                name,
                value,
                inline: Boolean(inline),
            })),
            thumbnailUrl: saved.embed?.thumbnailUrl ?? null,
            imageUrl: saved.embed?.imageUrl ?? null,
            footer: { text: saved.embed?.footer?.text ?? null, iconUrl: saved.embed?.footer?.iconUrl ?? null },
            timestamp: Boolean(saved.embed?.timestamp),
        },
        buttons: (saved.buttons ?? []).map(({ label, url, emoji }) => ({ label, url, emoji: emoji ?? null })),
        allowPings: Boolean(saved.allowPings),
        updatedAt: saved.updatedAt ? new Date(saved.updatedAt).toISOString() : null,
    };
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {{ op: string, messageId?: unknown, message?: unknown }} payload
 * @param {import('../../../dashboard/validation.js').GuildContext} context
 * @returns {Promise<Result>}
 */
export async function customEmbedsDashboard(guild, payload, context) {
    const { op } = payload;
    const channelName = (id) => `#${guild.channels.cache.get(id)?.name ?? 'deleted-channel'}`;

    if (op === 'list') {
        const saved = await CustomMessage.find({ guildId: guild.id }).sort({ updatedAt: -1 }).lean();
        return { ok: true, data: { messages: saved.map(customMessageView) } };
    }

    const id = typeof payload.messageId === 'string' ? payload.messageId : null;
    if (id !== null && !OBJECT_ID.test(id)) return { ok: false, status: 404, error: 'That message no longer exists' };
    const existing = id ? await CustomMessage.findOne({ _id: id, guildId: guild.id }).lean() : null;
    if (id && !existing) return { ok: false, status: 404, error: 'That message no longer exists' };

    if (op === 'delete') {
        await CustomMessage.deleteOne({ _id: existing._id });
        await removePostedMessage(guild, existing);
        return {
            ok: true,
            data: { removed: id },
            changes: [`"${existing.name}" in ${channelName(existing.channelId)}`],
            action: 'Deleted a custom message',
        };
    }

    if (op !== 'save') return { ok: false, status: 400, error: 'Unknown custom embeds action' };

    const { message: valid, errors } = validateCustomMessage(payload.message, context);
    if (!valid) return { ok: false, status: 400, error: 'Some details are not valid', details: errors };

    if (!existing && (await CustomMessage.countDocuments({ guildId: guild.id })) >= CUSTOM_EMBED_LIMITS.MESSAGES_MAX) {
        return {
            ok: false,
            status: 400,
            error: `A server can keep at most ${CUSTOM_EMBED_LIMITS.MESSAGES_MAX} custom messages. Delete one first.`,
        };
    }

    const saved = existing
        ? await CustomMessage.findByIdAndUpdate(existing._id, { $set: valid }, { returnDocument: 'after' }).lean()
        : (await CustomMessage.create({ guildId: guild.id, ...valid })).toObject();

    const published = await publishMessage(guild, {
        channelId: saved.channelId,
        previous: existing ? { channelId: existing.channelId, messageId: existing.messageId } : null,
        message: await customMessage(guild, saved),
        label: 'Custom Embeds',
    });

    let current = saved;
    if (published.ok && published.messageId !== saved.messageId) {
        current = (await CustomMessage.findByIdAndUpdate(
            saved._id,
            { $set: { messageId: published.messageId } },
            { returnDocument: 'after' }
        ).lean()) ?? { ...saved, messageId: published.messageId };
    }

    const moved = existing && existing.channelId !== valid.channelId;
    const changes = [
        existing
            ? `"${valid.name}" in ${channelName(valid.channelId)}${moved ? ` (moved from ${channelName(existing.channelId)})` : ''}`
            : `"${valid.name}" in ${channelName(valid.channelId)}`,
    ];
    const view = customMessageView(current);
    // Saved either way, so nothing typed is lost; the page shows it as not posted
    return {
        ok: true,
        data: published.ok ? { message: view } : { message: view, warning: published.error },
        changes,
        action: existing ? 'Updated a custom message' : 'Posted a custom message',
    };
}
