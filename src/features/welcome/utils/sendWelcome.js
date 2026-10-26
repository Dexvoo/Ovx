import { PermissionFlagsBits } from 'discord.js';
import Welcome_Cache from '../cache/welcome.cache.js';
import { buildMessage } from './welcomeMessage.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { LogData } from '../../../shared/utils/logger.js';

const NEEDED_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
];

/**
 * Posts the server's welcome or goodbye message for a member, if it's switched on.
 * Bots are skipped: these messages are for people.
 * If the channel is gone or the bot can't post there, nothing is sent and a warning is logged.
 *
 * @param {'welcome' | 'goodbye'} kind
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} member
 * @returns {Promise<boolean>} Whether a message was sent
 */
export async function sendWelcome(kind, member) {
    if (member.user.bot) return false;

    const { guild } = member;
    const settings = (await Welcome_Cache.get(guild.id))[kind];
    if (!settings?.enabled || !settings.channelId) return false;

    const channel = guild.channels.cache.get(settings.channelId);
    if (!channel?.isTextBased()) {
        LogData('Welcome', `Guild: ${guild.name} | The ${kind} channel no longer exists`, 'warning');
        return false;
    }
    if (!guild.members.me?.permissionsIn(channel).has(NEEDED_PERMISSIONS)) {
        LogData(
            'Welcome',
            `Guild: ${guild.name} | Missing permissions to post ${kind} messages in #${channel.name}`,
            'warning'
        );
        return false;
    }

    try {
        await channel.send(buildMessage(kind, settings, member, await brandColour(guild.id)));
        return true;
    } catch (error) {
        LogData('Welcome', `Guild: ${guild.name} | Could not send the ${kind} message: ${error.message}`, 'error');
        return false;
    }
}
