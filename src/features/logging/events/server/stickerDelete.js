import { Events, AuditLogEvent } from 'discord.js';
import { postServerLog } from '../../utils/serverLog.js';

export const name = Events.GuildStickerDelete;
export const once = false;
export const description = 'Sticker Delete Logs';

/**
 * @param {import('discord.js').Sticker} sticker
 */
export async function execute(sticker) {
    if (!sticker.guild) return;

    await postServerLog(sticker.guild, {
        titleKey: 'sticker_delete',
        colour: 'Red',
        description: `**${sticker.name}**`,
        auditType: AuditLogEvent.StickerDelete,
        targetId: sticker.id,
        footer: `SID: ${sticker.id}`,
        thumbnail: sticker.url,
    });
}
