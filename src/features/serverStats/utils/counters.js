import { ChannelType, OverwriteType, PermissionFlagsBits } from 'discord.js';
import { ServerStats } from '../models/serverStats.js';
import { LogData } from '../../../shared/utils/logger.js';

/** Discord lets a channel be renamed twice every 10 minutes, so counters update at most this often. */
export const UPDATE_MS = 10 * 60 * 1000;
export const COUNTERS_MAX = 5;
/** Bigger servers aren't loaded in full just to count people and bots */
const FETCH_MAX_MEMBERS = 25_000;

/**
 * @typedef {import('../models/serverStats.js').Counter} Counter
 */

/** Counters that need every member loaded to count. */
const needsMembers = (type) => type === 'humans' || type === 'bots' || type === 'role';

/**
 * A counter's number, or null when it can't be counted (e.g. a server too big to load, or a deleted role).
 * @param {import('discord.js').Guild} guild
 * @param {Counter} counter
 */
export function countFor(guild, counter) {
    const members = guild.members.cache;
    const complete = members.size >= guild.memberCount;
    switch (counter.type) {
        case 'members':
            return guild.memberCount;
        case 'humans':
            return complete ? members.filter((member) => !member.user.bot).size : null;
        case 'bots':
            return complete ? members.filter((member) => member.user.bot).size : null;
        case 'boosts':
            return guild.premiumSubscriptionCount ?? 0;
        case 'channels':
            return guild.channels.cache.filter(
                (channel) => channel.type !== ChannelType.GuildCategory && !channel.isThread()
            ).size;
        case 'roles':
            return guild.roles.cache.size - 1; // Not @everyone
        case 'role': {
            const role = counter.roleId ? guild.roles.cache.get(counter.roleId) : null;
            return role && complete ? role.members.size : null;
        }
        default:
            return null;
    }
}

/**
 * A counter's channel name.
 * @param {import('discord.js').Guild} guild
 * @param {Counter} counter
 * @param {number | null} count
 */
export function counterName(guild, counter, count) {
    const role = counter.roleId ? (guild.roles.cache.get(counter.roleId)?.name ?? 'role') : '';
    const text = count === null ? '…' : count.toLocaleString('en-GB');
    return counter.template.replaceAll('{count}', text).replaceAll('{role}', role).trim().slice(0, 100) || text;
}

/**
 * Loads every member when a counter needs it (servers up to FETCH_MAX_MEMBERS).
 * @param {import('discord.js').Guild} guild
 * @param {Counter[]} counters
 */
async function loadMembersIfNeeded(guild, counters) {
    if (!counters.some((counter) => needsMembers(counter.type))) return;
    if (guild.members.cache.size >= guild.memberCount || guild.memberCount > FETCH_MAX_MEMBERS) return;
    await guild.members.fetch({ time: 30_000 }).catch(() => {});
}

/**
 * Renames a server's counter channels whose number changed.
 * @param {import('discord.js').Guild} guild
 * @param {Counter[]} counters
 * @returns {Promise<number>} How many were renamed
 */
export async function updateCounters(guild, counters) {
    await loadMembersIfNeeded(guild, counters);
    let renamed = 0;
    for (const counter of counters) {
        const channel = guild.channels.cache.get(counter.channelId);
        if (!channel) continue; // Deleted by hand; the dashboard shows it as missing
        const count = countFor(guild, counter);
        if (count === null) continue;
        const name = counterName(guild, counter, count);
        if (channel.name === name) continue;
        try {
            await channel.setName(name, 'Server stats');
            renamed++;
        } catch (error) {
            LogData('Server Stats', `Guild: ${guild.name} | Could not update a counter: ${error.message}`, 'warning');
        }
    }
    return renamed;
}

/**
 * Updates every server's counters on this shard. Run every UPDATE_MS.
 * @param {import('discord.js').Client} client
 */
export async function updateAll(client) {
    const guildIds = [...client.guilds.cache.keys()];
    if (guildIds.length === 0) return;
    const configs = await ServerStats.find({ guildId: { $in: guildIds }, 'counters.0': { $exists: true } }).lean();
    for (const config of configs) {
        const guild = client.guilds.cache.get(config.guildId);
        if (guild) await updateCounters(guild, config.counters);
    }
}

/**
 * Makes a new counter's channel: a voice channel everyone can see but nobody can join, in Ovx's stats category
 * (made the first time).
 * @param {import('discord.js').Guild} guild
 * @param {Counter} counter - Without its channelId yet
 * @param {string | null} categoryId
 * @param {string} reason
 * @returns {Promise<{ channelId: string, categoryId: string }>}
 */
export async function createCounterChannel(guild, counter, categoryId, reason) {
    const me = guild.members.me;
    let category = categoryId ? guild.channels.cache.get(categoryId) : null;
    if (!category || category.type !== ChannelType.GuildCategory) {
        category = await guild.channels.create({
            name: '📊 Server Stats',
            type: ChannelType.GuildCategory,
            position: 0,
            reason,
        });
    }
    await loadMembersIfNeeded(guild, [counter]);
    const channel = await guild.channels.create({
        name: counterName(guild, counter, countFor(guild, counter)),
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
            { id: guild.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.Connect] },
            ...(me
                ? [
                      {
                          id: me.id,
                          type: OverwriteType.Member,
                          allow: [
                              PermissionFlagsBits.ViewChannel,
                              PermissionFlagsBits.ManageChannels,
                              PermissionFlagsBits.Connect,
                          ],
                      },
                  ]
                : []),
        ],
        reason,
    });
    return { channelId: channel.id, categoryId: category.id };
}
