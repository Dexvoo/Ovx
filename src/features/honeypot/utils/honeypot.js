import { PermissionFlagsBits } from 'discord.js';
import Honeypot_Config_Cache from '../cache/honeypotConfig.cache.js';
import { TempBan } from '../../moderation/models/moderationTimers.js';
import { notifyMember, recordCase } from '../../moderation/utils/common.js';
import { Translate } from '../../../shared/utils/i18n.js';
import { LogData } from '../../../shared/utils/logger.js';

/** "guildId:userId" of members being removed: a compromised account often posts several messages at once */
const removing = new Set();

/**
 * Bans (or softbans) a member who posted in the honeypot channel.
 * Moderators (Manage Messages, so they can post a warning there), bots and members Ovx can't ban are left alone.
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>} Whether the member was removed
 */
export async function checkMessage(message) {
    if (!message.inGuild() || message.author?.bot || message.webhookId) return false;
    const { guild, channel, member } = message;
    if (!member) return false;

    const config = await Honeypot_Config_Cache.get(guild.id);
    if (!config.enabled || !config.channelId) return false;
    // Threads inside the channel count too
    if (channel.id !== config.channelId && (!channel.isThread() || channel.parentId !== config.channelId)) return false;
    if (channel.permissionsFor(member)?.has(PermissionFlagsBits.ManageMessages)) return false;

    const key = `${guild.id}:${member.id}`;
    if (removing.has(key)) return false;
    if (!member.bannable) {
        LogData(
            'Honeypot',
            `Guild: ${guild.name} | Can't ban ${member.id}: no Ban Members, or their role is higher`,
            'debug'
        );
        return false;
    }

    removing.add(key);
    try {
        const removed = await removeMember(guild, member, config);
        // The ban only deletes their messages when set to; this one goes either way
        if (removed && !config.deleteMessageSeconds) await message.delete().catch(() => {});
        return removed;
    } finally {
        removing.delete(key);
    }
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member
 * @param {import('../models/honeypotConfig.js').HoneypotConfigType} config
 */
async function removeMember(guild, member, config) {
    const softban = config.action === 'softban';
    const reason = Translate('honeypot.reason', guild.preferredLocale);
    // The moderation helpers take an interaction; Ovx stands in as the moderator
    const actor = /** @type {any} */ ({
        guild,
        guildId: guild.id,
        client: guild.client,
        user: guild.client.user,
        locale: guild.preferredLocale,
    });

    // Before the ban, while they still share a server with Ovx
    if (config.notify) await notifyMember(actor, member.user, softban ? 'kick' : 'ban', { reason });

    try {
        await guild.bans.create(member.id, { reason, deleteMessageSeconds: config.deleteMessageSeconds });
    } catch (error) {
        LogData('Honeypot', `Guild: ${guild.name} | Could not ban ${member.id}: ${error.message}`, 'warning');
        return false;
    }

    if (softban) {
        await guild.bans.remove(member.id, reason).catch((error) => {
            LogData('Honeypot', `Guild: ${guild.name} | Could not unban ${member.id}: ${error.message}`, 'warning');
        });
    } else {
        // Banned for good: an older temporary ban mustn't lift it
        await TempBan.deleteOne({ guildId: guild.id, userId: member.id }).catch(() => {});
    }

    // Discord's ban events don't record Ovx's own actions as cases, so it's done here
    await recordCase(actor, softban ? 'kick' : 'ban', member.user, { reason });
    LogData('Honeypot', `Guild: ${guild.name} | ${softban ? 'Softbanned' : 'Banned'} ${member.id}`, 'info');
    return true;
}
