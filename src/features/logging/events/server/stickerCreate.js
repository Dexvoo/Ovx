import { Events, AuditLogEvent } from 'discord.js';
import { postServerLog } from '../../utils/serverLog.js';

export const name = Events.GuildStickerCreate;
export const once = false;
export const description = 'Sticker Create Logs';

/**
 * @param {import('discord.js').Sticker} sticker
 */
export async function execute(sticker) {
    if (!sticker.guild) return;

    await postServerLog(sticker.guild, {
        titleKey: 'sticker_create',
        colour: 'Green',
        description: `**${sticker.name}**${sticker.description ? `\n${sticker.description}` : ''}`,
        auditType: AuditLogEvent.StickerCreate,
        targetId: sticker.id,
        footer: `SID: ${sticker.id}`,
        thumbnail: sticker.url,
    });
}
