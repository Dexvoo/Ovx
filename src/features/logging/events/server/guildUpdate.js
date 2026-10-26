import { Events, AuditLogEvent } from 'discord.js';
import { describeGuildChanges } from '../../utils/serverChanges.js';
import { postServerLog } from '../../utils/serverLog.js';

export const name = Events.GuildUpdate;
export const once = false;
export const description = 'Guild Update Logs';

/**
 * @param {import('discord.js').Guild} oldGuild
 * @param {import('discord.js').Guild} newGuild
 */
export async function execute(oldGuild, newGuild) {
    const changes = describeGuildChanges(oldGuild, newGuild);
    if (changes.length === 0) return; // e.g. only the member count or features changed

    await postServerLog(newGuild, {
        titleKey: 'update',
        colour: 'White',
        description: newGuild.client.utils.Truncate(changes.join('\n'), 4000),
        auditType: AuditLogEvent.GuildUpdate,
        targetId: newGuild.id,
        footer: `GID: ${newGuild.id}`,
        thumbnail: oldGuild.icon !== newGuild.icon ? newGuild.iconURL({ size: 256 }) : null,
    });
}
