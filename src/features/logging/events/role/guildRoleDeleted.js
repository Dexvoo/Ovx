import { Events, AuditLogEvent } from 'discord.js';
import { getLogChannel, findAuditLogExecutor } from '../../utils/logChannel.js';

export const name = Events.GuildRoleDelete;
export const once = false;
export const description = 'Guild Role Delete Logs';

/**
 * @param {import('discord.js').Role} role
 */

export async function execute(role) {
    const { guild, client } = role;

    if (!guild) return;

    const logChannel = await getLogChannel(guild, 'role');
    if (!logChannel) return;

    const executor = await findAuditLogExecutor(guild, AuditLogEvent.RoleDelete, (entry) => entry.targetId === role.id);
    const username = executor?.username ?? 'Unknown';

    const title = client.utils.Translate('logs.role.delete', guild.preferredLocale, { username });
    const footerText = `RID: ${role.id} | ${executor ? `UID: ${executor.id}` : ''}`;

    await client.utils.Embed(logChannel, 'Red', title, `@${role.name} | ${executor ?? 'Unknown Tag'}`, {
        timestamp: true,
        footer: { text: footerText },
    });
}
