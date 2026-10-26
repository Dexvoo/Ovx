import { PermissionFlagsBits } from 'discord.js';
import Invite_Config_Cache from '../cache/inviteConfig.cache.js';
import { hasBlockedInvite } from './detect.js';
import { caseCounts } from '../../moderation/utils/cases.js';
import { runWarnAction } from '../../moderation/utils/warnActions.js';
import { notifyMember, recordCase, postPunishmentLog } from '../../moderation/utils/common.js';
import { Translate } from '../../../shared/utils/i18n.js';
import { LogData } from '../../../shared/utils/logger.js';

const NOTICE_DELETE_MS = 8000;
/** Someone pasting several invites at once gets one notice and one warning, not one per message */
const NOTICE_COOLDOWN_MS = 10_000;
const WARN_COOLDOWN_MS = 60_000;

/** "guildId:userId" → when they were last told / warned */
const lastNotice = new Map();
const lastWarning = new Map();

/**
 * Whether it's been long enough since the last time, and records now if so.
 * @param {Map<string, number>} map
 * @param {string} key
 * @param {number} cooldownMs
 * @param {number} now
 */
function due(map, key, cooldownMs, now) {
    if (now - (map.get(key) ?? 0) < cooldownMs) return false;
    map.set(key, now);
    if (map.size > 5000) map.delete(map.keys().next().value); // Oldest first
    return true;
}

/**
 * Deletes a message with an invite link that isn't allowed, then tells and (if set) warns the member.
 * Moderators (Manage Messages), bots, ignored channels and ignored roles are left alone.
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>} Whether the message was removed
 */
export async function checkMessage(message, now = Date.now()) {
    if (!message.inGuild() || message.author?.bot || message.webhookId || !message.content) return false;
    const { guild, channel, member } = message;
    if (!member) return false;

    const config = await Invite_Config_Cache.get(guild.id);
    if (!config.enabled) return false;
    // A thread follows its channel's setting
    const channelIds = [channel.id, channel.isThread() ? channel.parentId : null];
    if (channelIds.some((id) => id && config.ignoredChannelIds.includes(id))) return false;
    if (config.ignoredRoleIds.some((roleId) => member.roles.cache.has(roleId))) return false;
    if (channel.permissionsFor(member)?.has(PermissionFlagsBits.ManageMessages)) return false;

    if (!(await hasBlockedInvite(guild, message.content, config.allowOwnInvites))) return false;

    const me = guild.members.me;
    if (!me || !channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)) {
        LogData(
            'Invite Blocker',
            `Guild: ${guild.name} | Can't delete an invite in #${channel.name}: no Manage Messages`,
            'debug'
        );
        return false;
    }
    try {
        await message.delete();
    } catch {
        return false; // Already deleted, e.g. by another bot
    }

    const key = `${guild.id}:${member.id}`;
    const locale = guild.preferredLocale;
    const reason = Translate('inviteBlocker.reason', locale);

    if (config.notify && due(lastNotice, key, NOTICE_COOLDOWN_MS, now)) {
        const notice = await channel
            .send({
                content: Translate('inviteBlocker.notice', locale, { user: `${member}` }),
                allowedMentions: { users: [member.id] },
            })
            .catch(() => null);
        if (notice) setTimeout(() => notice.delete().catch(() => {}), NOTICE_DELETE_MS).unref?.();
    }

    if (config.warn && due(lastWarning, key, WARN_COOLDOWN_MS, now)) await warnMember(guild, member, reason);
    return true;
}

/**
 * Warns a member in Ovx's own name, like /moderation warn: a case, a DM, the Punishment log and any automatic action.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member
 * @param {string} reason
 */
async function warnMember(guild, member, reason) {
    // The moderation helpers take an interaction; Ovx stands in as the moderator
    const actor = /** @type {any} */ ({
        guild,
        guildId: guild.id,
        client: guild.client,
        user: guild.client.user,
        locale: guild.preferredLocale,
    });
    try {
        const caseNumber = await recordCase(actor, 'warn', member.user, { reason });
        if (!caseNumber) return;
        await notifyMember(actor, member.user, 'warn', { reason });
        const counts = await caseCounts(guild.id, member.id);
        await postPunishmentLog(actor, 'Gold', 'warn', {
            user: member.toString(),
            userId: member.id,
            reason,
            moderator: guild.client.user.toString(),
            case: caseNumber,
            count: counts.warn,
        });
        await runWarnAction(actor, member, counts.warn);
    } catch (error) {
        LogData('Invite Blocker', `Guild: ${guild.name} | Could not warn ${member.id}: ${error.message}`, 'warning');
    }
}
