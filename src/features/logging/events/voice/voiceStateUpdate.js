import { Events } from 'discord.js';
import { getLogChannel } from '../../utils/logChannel.js';

export const name = Events.VoiceStateUpdate;
export const once = false;
export const description = 'Guild Voice Logs';

/**
 * @typedef {import('../../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').VoiceState & { client: Client }} oldState
 * @param {import('discord.js').VoiceState & { client: Client }} newState
 */

export async function execute(oldState, newState) {
    const { guild, member, client } = newState;

    if (!guild) return;

    const relevantChannelId = newState.channelId || oldState.channelId;

    const logChannel = await getLogChannel(guild, 'voice', { sourceChannelId: relevantChannelId });
    if (!logChannel) return;

    const footer = { text: `CID: ${relevantChannelId} | UID: ${member.id}` };

    if (!oldState.channel && newState.channel)
        return client.utils.Embed(
            logChannel,
            'Green',
            client.utils.Translate('logs.voice.joined', guild.preferredLocale),
            `${newState.channel}`,
            { author: member.user, footer, timestamp: Date.now() }
        );
    if ((oldState.channel && !newState.channel) || !newState.channel)
        return client.utils.Embed(
            logChannel,
            'Red',
            client.utils.Translate('logs.voice.left', guild.preferredLocale),
            `${oldState.channel}`,
            { author: member.user, footer, timestamp: Date.now() }
        );

    if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id)
        return client.utils.Embed(
            logChannel,
            'Green',
            client.utils.Translate('logs.voice.switched', guild.preferredLocale),
            `${oldState.channel} => ${newState.channel}`,
            { author: member.user, footer, timestamp: Date.now() }
        );

    if (oldState.serverDeaf && !newState.serverDeaf)
        return client.utils.Embed(
            logChannel,
            'Green',
            client.utils.Translate('logs.voice.server_undeafened', guild.preferredLocale),
            `${oldState.channel}`,
            { author: member.user, footer, timestamp: Date.now() }
        );
    if (!oldState.serverDeaf && newState.serverDeaf)
        return client.utils.Embed(
            logChannel,
            'Red',
            client.utils.Translate('logs.voice.server_deafened', guild.preferredLocale),
            `${newState.channel}`,
            { author: member.user, footer, timestamp: Date.now() }
        );

    if (oldState.serverMute && !newState.serverMute)
        return client.utils.Embed(
            logChannel,
            'Green',
            client.utils.Translate('logs.voice.server_unmuted', guild.preferredLocale),
            `${oldState.channel}`,
            { author: member.user, footer, timestamp: Date.now() }
        );
    if (!oldState.serverMute && newState.serverMute)
        return client.utils.Embed(
            logChannel,
            'Red',
            client.utils.Translate('logs.voice.server_muted', guild.preferredLocale),
            `${newState.channel}`,
            { author: member.user, footer, timestamp: Date.now() }
        );

    if (oldState.selfVideo && !newState.selfVideo)
        return client.utils.Embed(
            logChannel,
            'Red',
            client.utils.Translate('logs.voice.video_disabled', guild.preferredLocale),
            `${oldState.channel}`,
            { author: member.user, footer, timestamp: Date.now() }
        );
    if (!oldState.selfVideo && newState.selfVideo)
        return client.utils.Embed(
            logChannel,
            'Green',
            client.utils.Translate('logs.voice.video_enabled', guild.preferredLocale),
            `${newState.channel}`,
            { author: member.user, footer, timestamp: Date.now() }
        );
}
