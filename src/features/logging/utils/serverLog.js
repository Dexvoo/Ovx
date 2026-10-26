import { getLogChannel, findAuditLogEntry, moderationDetails } from './logChannel.js';

/**
 * Posts a server log (server settings, emojis, stickers) with whoever made the change, if the audit log says.
 *
 * @param {import('discord.js').Guild} guild
 * @param {object} log
 * @param {string} log.titleKey - Translation key under logs.server
 * @param {keyof typeof import('discord.js').Colors} log.colour
 * @param {string} log.description
 * @param {import('discord.js').AuditLogEvent} log.auditType - Used to find who made the change
 * @param {string} log.targetId - The changed server, emoji or sticker
 * @param {string} log.footer
 * @param {string | null} [log.thumbnail]
 */
export async function postServerLog(guild, { titleKey, colour, description, auditType, targetId, footer, thumbnail }) {
    const logChannel = await getLogChannel(guild, 'server');
    if (!logChannel) return;

    const entry = await findAuditLogEntry(
        guild,
        auditType,
        (item) => item.targetId === targetId && Date.now() - item.createdTimestamp < 10_000
    );
    const executor = entry?.executor ?? null;

    const { client } = guild;
    // Done with /emoji or /sticker: Discord records Ovx, so the member who used the command is named too
    const viaOvx = executor?.id === client.user?.id ? moderationDetails(entry, client.user.id) : null;
    const byLine = viaOvx && viaOvx.moderator !== executor.toString() ? `\n-# By ${viaOvx.moderator}` : '';

    await client.utils.Embed(
        logChannel,
        colour,
        client.utils.Translate(`logs.server.${titleKey}`, guild.preferredLocale),
        description + byLine,
        {
            timestamp: true,
            footer: { text: executor ? `${footer} | UID: ${executor.id}` : footer },
            author: executor,
            thumbnail: thumbnail ?? false,
        }
    );
}
