import { PermissionFlagsBits } from 'discord.js';
import { LogData } from './logger.js';

/**
 * Messages the dashboard posts and keeps up to date (reaction role panels, custom embeds).
 */

const POST_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
];

/**
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @returns {import('discord.js').GuildTextBasedChannel | null}
 */
export function postableChannel(guild, channelId) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased() || !guild.members.me) return null;
    return channel.permissionsFor(guild.members.me).has(POST_PERMISSIONS) ? channel : null;
}

/**
 * Posts a message, or edits the one already posted if it's still in the same channel. When the channel
 * changed, or the old message was deleted, a new message is posted (and the old one removed).
 * @param {import('discord.js').Guild} guild
 * @param {{
 *   channelId: string,
 *   previous: { channelId: string, messageId?: string | null } | null,
 *   message: import('discord.js').MessageCreateOptions,
 *   label: string,
 * }} options - label names the feature in logs, e.g. "Reaction Roles"
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>} error is set when not ok
 */
export async function publishMessage(guild, { channelId, previous, message, label }) {
    const channel = postableChannel(guild, channelId);
    if (!channel) {
        return {
            ok: false,
            error: "Ovx can't post in that channel. It needs to view it, send messages and embed links.",
        };
    }

    if (previous?.messageId && previous.channelId === channelId) {
        const existing = await channel.messages.fetch(previous.messageId).catch(() => null);
        if (existing) {
            try {
                await existing.edit(/** @type {import('discord.js').MessageEditOptions} */ (message));
                return { ok: true, messageId: previous.messageId };
            } catch (error) {
                return { ok: false, error: `Couldn't update the message: ${error.message}` };
            }
        }
    }

    let posted;
    try {
        posted = await channel.send(message);
    } catch (error) {
        LogData(label, `Guild: ${guild.name} | Could not post: ${error.message}`, 'warning');
        return { ok: false, error: `Couldn't post in #${channel.name}: ${error.message}` };
    }

    if (previous?.messageId && previous.channelId !== channelId) await removePostedMessage(guild, previous);
    return { ok: true, messageId: posted.id };
}

/**
 * Deletes a posted message, if it's still there.
 * @param {import('discord.js').Guild} guild
 * @param {{ channelId: string, messageId?: string | null }} where
 */
export async function removePostedMessage(guild, { channelId, messageId }) {
    if (!messageId) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return;
    await channel.messages.delete(messageId).catch(() => {}); // Already deleted, or no access: nothing to do
}
