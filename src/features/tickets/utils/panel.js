import { PermissionFlagsBits } from 'discord.js';
import Ticket_Config_Cache from '../cache/ticketConfig.cache.js';
import { panelMessage } from './components.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';

const PANEL_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
];

/**
 * @typedef {{ ok: true, messageUrl: string, updated: boolean } |
 *   { ok: false, reason: 'no_channel' | 'bot_permissions', missing?: string[] }} PanelResult
 */

/**
 * Posts the "Create Ticket" panel in a channel, or updates the one already there (so there's never a duplicate).
 * Moving it to another channel posts a new one; the old message is deleted if the bot can.
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @returns {Promise<PanelResult>}
 */
export async function postPanel(guild, channelId) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased() || channel.isThread() || channel.isVoiceBased())
        return { ok: false, reason: 'no_channel' };

    const missing = guild.members.me?.permissionsIn(channel).missing(PANEL_PERMISSIONS) ?? [];
    if (missing.length > 0) return { ok: false, reason: 'bot_permissions', missing };

    const config = await Ticket_Config_Cache.get(guild.id);
    const content = panelMessage(config, await brandColour(guild.id));

    const { channelId: oldChannelId, messageId: oldMessageId } = config.panel;
    if (oldChannelId === channel.id && oldMessageId) {
        const existing = await channel.messages.fetch(oldMessageId).catch(() => null);
        if (existing) {
            await existing.edit(content);
            return { ok: true, messageUrl: existing.url, updated: true };
        }
    } else if (oldChannelId && oldMessageId) {
        const oldChannel = guild.channels.cache.get(oldChannelId);
        if (oldChannel?.isTextBased()) await oldChannel.messages.delete(oldMessageId).catch(() => {});
    }

    const message = await channel.send(content);
    await Ticket_Config_Cache.set(guild.id, { 'panel.channelId': channel.id, 'panel.messageId': message.id });
    return { ok: true, messageUrl: message.url, updated: false };
}
