import { Events, AuditLogEvent } from 'discord.js';
import { postServerLog } from '../../utils/serverLog.js';

export const name = Events.GuildStickerUpdate;
export const once = false;
export const description = 'Sticker Update Logs';

/**
 * @param {import('discord.js').Sticker} oldSticker
 * @param {import('discord.js').Sticker} newSticker
 */
export async function execute(oldSticker, newSticker) {
    if (!newSticker.guild) return;

    const lines = [];
    if (oldSticker.name !== newSticker.name) lines.push(`**Name:** \`${oldSticker.name}\` → \`${newSticker.name}\``);
    if (oldSticker.description !== newSticker.description) {
        lines.push(
            `**Description:** \`${oldSticker.description || 'None'}\` → \`${newSticker.description || 'None'}\``
        );
    }
    if (oldSticker.tags !== newSticker.tags) {
        lines.push(`**Related Emoji:** \`${oldSticker.tags || 'None'}\` → \`${newSticker.tags || 'None'}\``);
    }
    if (lines.length === 0) return;

    await postServerLog(newSticker.guild, {
        titleKey: 'sticker_update',
        colour: 'White',
        description: lines.join('\n'),
        auditType: AuditLogEvent.StickerUpdate,
        targetId: newSticker.id,
        footer: `SID: ${newSticker.id}`,
        thumbnail: newSticker.url,
    });
}
