import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import Automod_Config_Cache from '../cache/automodConfig.cache.js';
import { Translate } from '../../../shared/utils/i18n.js';
import { LogData } from '../../../shared/utils/logger.js';

/** Raid mode lasts this long after the last join that kept it going. */
export const RAID_MODE_MS = 10 * 60 * 1000;
/** New joiners timed out during a raid stay timed out this long (staff can lift it). */
const RAID_TIMEOUT_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per server (this shard only; a server always lives on one shard).
 * @type {Map<string, { joins: { id: string, at: number }[], raidUntil: number, handled: number, endTimer?: NodeJS.Timeout }>}
 */
const servers = new Map();

/** For tests. */
export function resetRaidState() {
    for (const state of servers.values()) clearTimeout(state.endTimer);
    servers.clear();
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {string} key - Under automod.raid
 * @param {Record<string, string | number>} [vars]
 */
const t = (guild, key, vars) => Translate(`automod.raid.${key}`, guild.preferredLocale, vars);

/**
 * Posts in the alert channel, pinging the chosen role.
 * @param {import('discord.js').Guild} guild
 * @param {import('../models/automodConfig.js').AutomodConfigType} config
 * @param {EmbedBuilder} embed
 * @param {boolean} ping
 */
async function alert(guild, config, embed, ping) {
    const channel = config.automod.alertChannelId ? guild.channels.cache.get(config.automod.alertChannelId) : null;
    if (!channel?.isSendable()) return;
    const role = ping ? config.raid.pingRoleId : null;
    await channel
        .send({
            content: role ? `<@&${role}>` : undefined,
            embeds: [embed],
            allowedMentions: { roles: role ? [role] : [] },
        })
        .catch((error) => LogData('Anti-raid', `Guild: ${guild.name} | Could not alert: ${error.message}`, 'warning'));
}

/**
 * Does the server's raid action to a member who joined during a raid.
 * @param {import('discord.js').GuildMember} member
 * @param {'alert' | 'timeout' | 'kick'} action
 * @returns {Promise<boolean>} Whether something was done
 */
async function act(member, action) {
    const reason = Translate('automod.raid.reason', member.guild.preferredLocale);
    try {
        if (action === 'timeout' && member.moderatable) {
            await member.timeout(RAID_TIMEOUT_MS, reason);
            return true;
        }
        if (action === 'kick' && member.kickable) {
            await member.kick(reason);
            return true;
        }
    } catch (error) {
        LogData(
            'Anti-raid',
            `Guild: ${member.guild.name} | Could not ${action} ${member.id}: ${error.message}`,
            'warning'
        );
    }
    return false;
}

/**
 * Removes a member whose account is newer than the server allows. They're told why, so they can come back later.
 * @param {import('discord.js').GuildMember} member
 * @param {number} days
 * @param {number} now
 * @returns {Promise<boolean>} Whether they were removed
 */
async function checkAccountAge(member, days, now) {
    if (days <= 0 || now - member.user.createdTimestamp >= days * DAY_MS || !member.kickable) return false;
    const { guild } = member;
    const canJoin = Math.floor((member.user.createdTimestamp + days * DAY_MS) / 1000);
    await member.send(t(guild, 'too_new_dm', { server: guild.name, days, when: `<t:${canJoin}:R>` })).catch(() => {}); // DMs closed: they're still removed
    try {
        await member.kick(t(guild, 'too_new_reason', { days }));
        return true;
    } catch (error) {
        LogData('Anti-raid', `Guild: ${guild.name} | Could not remove a new account: ${error.message}`, 'warning');
        return false;
    }
}

/**
 * Starts raid mode: staff are alerted, invites optionally paused, and everyone who joined in the burst handled.
 * @param {import('discord.js').Guild} guild
 * @param {import('../models/automodConfig.js').AutomodConfigType} config
 * @param {{ joins: { id: string, at: number }[], raidUntil: number, handled: number }} state
 * @param {number} now
 */
async function startRaid(guild, config, state, now) {
    const { raid } = config;
    state.raidUntil = now + RAID_MODE_MS;
    state.handled = 0;

    let pausedUntil = null;
    if (raid.pauseInvitesHours > 0 && guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
        pausedUntil = new Date(now + raid.pauseInvitesHours * 60 * 60 * 1000);
        await guild.setIncidentActions({ invitesDisabledUntil: pausedUntil }).catch((error) => {
            pausedUntil = null;
            LogData('Anti-raid', `Guild: ${guild.name} | Could not pause invites: ${error.message}`, 'warning');
        });
    }

    for (const { id } of state.joins) {
        const member = guild.members.cache.get(id);
        if (member && (await act(member, raid.action))) state.handled++;
    }

    const lines = [t(guild, 'started', { count: state.joins.length, seconds: raid.seconds })];
    if (raid.action !== 'alert') lines.push(t(guild, `doing_${raid.action}`, { minutes: RAID_MODE_MS / 60_000 }));
    if (pausedUntil)
        lines.push(t(guild, 'invites_paused', { until: `<t:${Math.floor(pausedUntil.getTime() / 1000)}:R>` }));
    lines.push('', t(guild, 'advice'));
    const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle(t(guild, 'title'))
        .setDescription(lines.join('\n'))
        .setTimestamp(now);
    await alert(guild, config, embed, true);
}

/**
 * Watches joins for raids, and removes accounts newer than the server allows.
 * @param {import('discord.js').GuildMember} member
 * @param {number} [now]
 */
export async function onMemberJoin(member, now = Date.now()) {
    if (member.user.bot) return; // Bots are added by staff
    const { guild } = member;
    const config = await Automod_Config_Cache.get(guild.id);
    const { raid } = config;

    if (await checkAccountAge(member, raid.minAccountDays, now)) return;
    if (!raid.enabled) return;

    const state = servers.get(guild.id) ?? { joins: [], raidUntil: 0, handled: 0 };
    servers.set(guild.id, state);
    state.joins = state.joins.filter((join) => now - join.at < raid.seconds * 1000);
    state.joins.push({ id: member.id, at: now });

    if (state.raidUntil > now) {
        // Raid mode: every new joiner is handled, and raid mode lasts while joins keep coming
        state.raidUntil = now + RAID_MODE_MS;
        if (await act(member, raid.action)) state.handled++;
    } else if (state.joins.length >= raid.joins) {
        await startRaid(guild, config, state, now);
    } else {
        return;
    }

    // Says when it's over, once joins have calmed down
    clearTimeout(state.endTimer);
    state.endTimer = setTimeout(
        async () => {
            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle(t(guild, 'ended_title'))
                .setDescription(
                    raid.action === 'alert'
                        ? t(guild, 'ended')
                        : t(guild, `ended_${raid.action}`, { count: state.handled })
                );
            await alert(guild, await Automod_Config_Cache.get(guild.id), embed, false);
            state.joins = [];
        },
        Math.max(0, state.raidUntil - now)
    );
    state.endTimer.unref?.();
}
