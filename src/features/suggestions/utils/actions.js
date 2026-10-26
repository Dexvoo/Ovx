import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
    Suggestion,
    SuggestionCounter,
    SuggestionConfig,
    suggestionDefaults,
    CLOSED_STATUSES,
    SUGGESTION_STATUSES,
} from '../models/suggestion.js';
import { suggestionMessage } from './post.js';
import { Translate } from '../../../shared/utils/i18n.js';
import { LogData } from '../../../shared/utils/logger.js';

export const CONTENT_MAX = 2000;
export const REASON_MAX = 500;
const OBJECT_ID = /^[a-f\d]{24}$/i;
const POST_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
];

/**
 * @typedef {import('../models/suggestion.js').SuggestionType} SuggestionType
 * @typedef {import('../models/suggestion.js').SuggestionConfigType} SuggestionConfigType
 */

/** @param {string} guildId @returns {Promise<SuggestionConfigType>} */
export async function suggestionConfig(guildId) {
    const stored = await SuggestionConfig.findOne({ guildId }).lean();
    return { ...suggestionDefaults(guildId), ...(stored ?? {}) };
}

/**
 * Whether a member can decide suggestions: Manage Server, or one of the suggestion manager roles.
 * @param {import('discord.js').GuildMember} member
 * @param {SuggestionConfigType} config
 */
export function canDecide(member, config) {
    return (
        member.permissions.has(PermissionFlagsBits.ManageGuild) ||
        config.managerRoleIds.some((roleId) => member.roles.cache.has(roleId))
    );
}

/**
 * Posts a new suggestion. Returns a translation key under suggestions.errors when it can't.
 * @param {import('discord.js').GuildMember} member
 * @param {{ content: string, imageUrl?: string | null }} input
 * @param {Date} [now]
 * @returns {Promise<{ ok: boolean, suggestion?: SuggestionType, error?: string, vars?: object }>} error is set when not ok
 */
export async function createSuggestion(member, { content, imageUrl = null }, now = new Date()) {
    const { guild } = member;
    const config = await suggestionConfig(guild.id);
    if (!config.enabled || !config.channelId) return { ok: false, error: 'off' };

    const channel = guild.channels.cache.get(config.channelId);
    const me = guild.members.me;
    if (!channel?.isTextBased() || !me || !channel.permissionsFor(me).has(POST_PERMISSIONS)) {
        return { ok: false, error: 'no_channel' };
    }

    const text = content.trim().slice(0, CONTENT_MAX);
    if (!text) return { ok: false, error: 'empty' };

    if (config.cooldownMinutes > 0 && !canDecide(member, config)) {
        const last = await Suggestion.findOne({ guildId: guild.id, authorId: member.id }, { createdAt: 1 })
            .sort({ createdAt: -1 })
            .lean();
        const ready = last ? new Date(last.createdAt).getTime() + config.cooldownMinutes * 60_000 : 0;
        if (ready > now.getTime())
            return { ok: false, error: 'cooldown', vars: { when: `<t:${Math.ceil(ready / 1000)}:R>` } };
    }

    const counter = await SuggestionCounter.findOneAndUpdate(
        { guildId: guild.id },
        { $inc: { last: 1 } },
        { upsert: true, returnDocument: 'after' }
    ).lean();
    const created = (
        await Suggestion.create({
            guildId: guild.id,
            number: counter.last,
            authorId: member.id,
            content: text,
            imageUrl,
            channelId: channel.id,
            createdAt: now,
        })
    ).toObject();

    let message;
    try {
        message = await channel.send(suggestionMessage(guild, created));
    } catch (error) {
        await Suggestion.deleteOne({ _id: created._id });
        LogData('Suggestions', `Guild: ${guild.name} | Could not post: ${error.message}`, 'warning');
        return { ok: false, error: 'no_channel' };
    }

    let threadId = null;
    if (config.threads && 'startThread' in message) {
        const thread = await message
            .startThread({
                name: Translate('suggestions.post.thread', guild.preferredLocale, { number: created.number }),
                autoArchiveDuration: 10_080,
            })
            .catch(() => null); // No thread permission: the suggestion still works
        threadId = thread?.id ?? null;
    }

    const saved = await Suggestion.findByIdAndUpdate(
        created._id,
        { $set: { messageId: message.id, threadId } },
        { returnDocument: 'after' }
    ).lean();
    return { ok: true, suggestion: saved ?? created };
}

/**
 * Updates a suggestion's message to match it.
 * @param {import('discord.js').Guild} guild
 * @param {SuggestionType} suggestion
 */
export async function refreshPost(guild, suggestion) {
    if (!suggestion.messageId) return;
    const channel = guild.channels.cache.get(suggestion.channelId);
    if (!channel?.isTextBased()) return;
    const message = await channel.messages.fetch(suggestion.messageId).catch(() => null);
    await message?.edit(suggestionMessage(guild, suggestion)).catch(() => {});
}

/**
 * A vote: 👍 or 👎. Clicking the same one again takes the vote back; clicking the other switches it.
 * @param {string} guildId
 * @param {string} suggestionId
 * @param {string} userId
 * @param {'up' | 'down'} direction
 * @returns {Promise<{ ok: boolean, suggestion?: SuggestionType, vote?: 'up' | 'down' | null, error?: string }>} error is set when not ok
 */
export async function vote(guildId, suggestionId, userId, direction) {
    if (!OBJECT_ID.test(suggestionId)) return { ok: false, error: 'gone' };
    const current = await Suggestion.findOne(
        { _id: suggestionId, guildId },
        { upvoters: 1, downvoters: 1, status: 1 }
    ).lean();
    if (!current) return { ok: false, error: 'gone' };
    if (CLOSED_STATUSES.includes(current.status)) return { ok: false, error: 'closed' };

    const mine = direction === 'up' ? 'upvoters' : 'downvoters';
    const other = direction === 'up' ? 'downvoters' : 'upvoters';
    const undo = current[mine].includes(userId);
    // One update that adds to one list and removes from the other, so a vote is never counted twice
    const update = undo ? { $pull: { [mine]: userId } } : { $addToSet: { [mine]: userId }, $pull: { [other]: userId } };
    const suggestion = await Suggestion.findOneAndUpdate(
        { _id: suggestionId, guildId, status: { $nin: CLOSED_STATUSES } },
        update,
        { returnDocument: 'after' }
    ).lean();
    if (!suggestion) return { ok: false, error: 'closed' };
    return { ok: true, suggestion, vote: undo ? null : direction };
}

/**
 * Staff decide a suggestion: its status, an optional reason, and who decided. The author is DMed if set.
 * @param {import('discord.js').Guild} guild
 * @param {number | string} which - Its number, or its ID (from the dashboard)
 * @param {string} status
 * @param {{ reason?: string | null, decidedBy: string }} details
 * @returns {Promise<{ ok: boolean, suggestion?: SuggestionType, error?: string }>} error is set when not ok
 */
export async function decide(guild, which, status, { reason = null, decidedBy }) {
    if (!SUGGESTION_STATUSES.includes(status) || status === 'pending') return { ok: false, error: 'bad_status' };
    const filter =
        typeof which === 'number'
            ? { guildId: guild.id, number: which }
            : OBJECT_ID.test(which)
              ? { guildId: guild.id, _id: which }
              : null;
    if (!filter) return { ok: false, error: 'not_found' };

    const suggestion = await Suggestion.findOneAndUpdate(
        filter,
        { $set: { status, reason: reason?.trim().slice(0, REASON_MAX) || null, decidedBy, decidedAt: new Date() } },
        { returnDocument: 'after' }
    ).lean();
    if (!suggestion) return { ok: false, error: 'not_found' };

    await refreshPost(guild, suggestion);
    const config = await suggestionConfig(guild.id);
    if (config.dmAuthor) await notifyAuthor(guild, suggestion);
    return { ok: true, suggestion };
}

/**
 * Tells the author what was decided, with a link to their suggestion.
 * @param {import('discord.js').Guild} guild
 * @param {SuggestionType} suggestion
 */
async function notifyAuthor(guild, suggestion) {
    const t = (key, vars) => Translate(`suggestions.dm.${key}`, guild.preferredLocale, vars);
    const author = await guild.client.users.fetch(suggestion.authorId).catch(() => null);
    if (!author) return;
    const link = suggestion.messageId
        ? `https://discord.com/channels/${guild.id}/${suggestion.channelId}/${suggestion.messageId}`
        : null;
    const embed = new EmbedBuilder()
        .setColor('#b69cff')
        .setTitle(t('title', { number: suggestion.number, guild: guild.name }))
        .setDescription(
            [
                t(`status_${suggestion.status}`),
                suggestion.reason ? `\n**${t('reason')}:** ${suggestion.reason}` : '',
                link ? `\n[${t('view')}](${link})` : '',
            ].join('')
        );
    await author.send({ embeds: [embed] }).catch(() => {}); // DMs closed
}

/**
 * Removes a suggestion and its message (and thread).
 * @param {import('discord.js').Guild} guild
 * @param {string} suggestionId
 */
export async function deleteSuggestion(guild, suggestionId) {
    if (!OBJECT_ID.test(suggestionId)) return null;
    const removed = await Suggestion.findOneAndDelete({ _id: suggestionId, guildId: guild.id }).lean();
    if (!removed) return null;
    const channel = guild.channels.cache.get(removed.channelId);
    if (channel?.isTextBased() && removed.messageId) await channel.messages.delete(removed.messageId).catch(() => {});
    if (removed.threadId)
        await guild.channels.cache
            .get(removed.threadId)
            ?.delete()
            .catch(() => {});
    return removed;
}
