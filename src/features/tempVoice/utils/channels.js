import { ChannelType, OverwriteType, PermissionFlagsBits } from 'discord.js';
import { TempChannel } from '../models/tempVoice.js';
import Temp_Voice_Config_Cache from '../cache/tempVoiceConfig.cache.js';
import { controlPanel } from './panel.js';
import { LogData } from '../../../shared/utils/logger.js';

const OWNER_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.Stream,
    PermissionFlagsBits.UseVAD,
];
/** So Ovx can always manage the channel, even in a private category */
const BOT_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.MoveMembers,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
];

/**
 * A new channel's name from the hub's template.
 * @param {string} template - May use {user} (their display name) and {username}
 * @param {import('discord.js').GuildMember} member
 */
export function channelName(template, member) {
    const name = template
        .replaceAll('{user}', member.displayName)
        .replaceAll('{username}', member.user.username)
        .trim()
        .slice(0, 100);
    return name || `${member.displayName}'s channel`.slice(0, 100);
}

/** Members (not bots) in a voice channel */
const people = (channel) => channel.members.filter((member) => !member.user.bot).size;

/** "guildId:userId" for members whose channel is being made right now, so quick re-joins don't make two */
const creating = new Set();

/**
 * Someone joined a hub: they get their own channel and are moved into it. If they already have one,
 * they're moved back to it instead.
 * @param {import('discord.js').GuildMember} member
 * @param {import('../models/tempVoice.js').VoiceHub} hub
 */
export async function createFor(member, hub) {
    const { guild } = member;
    const key = `${guild.id}:${member.id}`;
    if (creating.has(key)) return;
    creating.add(key);
    try {
        const existing = await TempChannel.findOne({ guildId: guild.id, ownerId: member.id }).lean();
        const theirs = existing ? guild.channels.cache.get(existing.channelId) : null;
        if (theirs?.isVoiceBased()) {
            await member.voice.setChannel(theirs).catch(() => {});
            return;
        }
        if (existing) await TempChannel.deleteOne({ channelId: existing.channelId });

        const hubChannel = guild.channels.cache.get(hub.channelId);
        const parent = guild.channels.cache.get(hub.categoryId ?? hubChannel?.parentId ?? '');
        const category = parent?.type === ChannelType.GuildCategory ? parent : null;
        const me = guild.members.me;
        if (!me) return;

        // The category's permissions, so the channel is as private (or public) as the others in it
        const inherited = category
            ? category.permissionOverwrites.cache.map((overwrite) => ({
                  id: overwrite.id,
                  type: overwrite.type,
                  allow: overwrite.allow,
                  deny: overwrite.deny,
              }))
            : [];
        const channel = await guild.channels.create({
            name: channelName(hub.nameTemplate, member),
            type: ChannelType.GuildVoice,
            parent: category?.id,
            userLimit: hub.userLimit,
            bitrate: hubChannel && 'bitrate' in hubChannel ? hubChannel.bitrate : undefined,
            permissionOverwrites: [
                ...inherited.filter((overwrite) => overwrite.id !== member.id && overwrite.id !== me.id),
                { id: member.id, type: OverwriteType.Member, allow: OWNER_PERMISSIONS },
                { id: me.id, type: OverwriteType.Member, allow: BOT_PERMISSIONS },
            ],
            reason: `Join-to-create channel for @${member.user.username}`,
        });

        try {
            await member.voice.setChannel(channel);
        } catch {
            // They left the hub before they could be moved: nobody to give it to
            await channel.delete('Join-to-create: the member left before moving').catch(() => {});
            return;
        }

        const panel = await channel.send(await controlPanel(channel, member.id)).catch(() => null);
        await TempChannel.create({
            guildId: guild.id,
            channelId: channel.id,
            ownerId: member.id,
            hubId: hub.channelId,
            panelMessageId: panel?.id ?? null,
        });
    } catch (error) {
        LogData('Temp Voice', `Guild: ${guild.name} | Could not make a channel: ${error.message}`, 'warning');
    } finally {
        creating.delete(key);
    }
}

/**
 * Deletes a join-to-create channel once nobody (apart from bots) is left in it.
 * @param {import('discord.js').VoiceBasedChannel} channel
 */
export async function deleteIfEmpty(channel) {
    if (people(channel) > 0) return;
    const record = await TempChannel.findOneAndDelete({ channelId: channel.id }).lean();
    if (!record) return; // Not a join-to-create channel
    await channel.delete('Join-to-create: everyone left').catch((error) => {
        LogData(
            'Temp Voice',
            `Guild: ${channel.guild.name} | Could not delete an empty channel: ${error.message}`,
            'warning'
        );
    });
}

/**
 * Someone joined, left or moved: joining a hub makes a channel, and leaving one of Ovx's channels may delete it.
 * @param {import('discord.js').VoiceState} before
 * @param {import('discord.js').VoiceState} after
 */
export async function handleVoiceChange(before, after) {
    if (before.channelId === after.channelId) return; // Muted, deafened, started streaming...
    const { guild } = after;
    const config = await Temp_Voice_Config_Cache.get(guild.id);

    if (before.channel) await deleteIfEmpty(before.channel);

    if (!config.enabled || !after.channelId || !after.member || after.member.user.bot) return;
    const hub = config.hubs.find((item) => item.channelId === after.channelId);
    if (hub) await createFor(after.member, hub);
}

/**
 * After a restart: channels that emptied while Ovx was offline are deleted, and records of deleted channels dropped.
 * @param {import('discord.js').Client} client
 */
export async function cleanUpChannels(client) {
    const guildIds = [...client.guilds.cache.keys()];
    if (guildIds.length === 0) return;
    const records = await TempChannel.find({ guildId: { $in: guildIds } }).lean();
    for (const record of records) {
        const channel = client.guilds.cache.get(record.guildId)?.channels.cache.get(record.channelId);
        if (!channel?.isVoiceBased()) await TempChannel.deleteOne({ channelId: record.channelId });
        else await deleteIfEmpty(channel);
    }
}
