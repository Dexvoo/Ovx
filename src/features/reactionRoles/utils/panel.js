import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { ReactionRolePanel } from '../models/reactionRolePanel.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { Translate } from '../../../shared/utils/i18n.js';
import { publishMessage, removePostedMessage } from '../../../shared/utils/postedMessage.js';

/** Button custom IDs: `rr:<panelId>:<roleId>` */
export const ROLE_BUTTON_PREFIX = 'rr';

const STYLES = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
};

/**
 * @typedef {import('../models/reactionRolePanel.js').ReactionRolePanelType} Panel
 */

/**
 * The panel's message: an embed, and its buttons in rows of five.
 * @param {import('discord.js').Guild} guild
 * @param {Panel} panel
 * @returns {Promise<import('discord.js').BaseMessageOptions>}
 */
export async function panelMessage(guild, panel) {
    const locale = guild.preferredLocale;
    const t = (key, vars) => Translate(`reactionRoles.panel.${key}`, locale, vars);

    const roleName = (roleId) => guild.roles.cache.get(roleId)?.name ?? 'deleted-role';
    const description =
        panel.description ||
        panel.buttons.map((button) => `${button.emoji ? `${button.emoji} ` : ''}<@&${button.roleId}>`).join('\n');

    const notes = [
        panel.mode === 'unique' && t('note_unique'),
        panel.mode === 'verify' && t('note_verify'),
        panel.mode === 'normal' && panel.maxRoles > 0 && t('note_max', { count: panel.maxRoles }),
        panel.requiredRoleId && t('note_required', { role: roleName(panel.requiredRoleId) }),
    ].filter(Boolean);

    const embed = new EmbedBuilder()
        .setColor(/** @type {`#${string}`} */ (panel.colour ?? (await brandColour(guild.id))))
        .setTitle(panel.title)
        .setDescription(description);
    if (notes.length > 0) embed.setFooter({ text: notes.join(' · ') });

    const buttons = panel.buttons.map((item) => {
        const button = new ButtonBuilder()
            .setCustomId(`${ROLE_BUTTON_PREFIX}:${panel._id}:${item.roleId}`)
            .setStyle(STYLES[item.style] ?? ButtonStyle.Secondary)
            .setLabel((item.label || roleName(item.roleId)).slice(0, 80));
        if (item.emoji) button.setEmoji(item.emoji);
        return button;
    });
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(
            /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
                buttons.slice(i, i + 5)
            )
        );
    }

    // Role mentions in the text are shown, never pinged
    return { embeds: [embed], components: rows, allowedMentions: { parse: [] } };
}

/**
 * Posts the panel, or edits its message if it's already posted in the same channel (see publishMessage).
 * @param {import('discord.js').Guild} guild
 * @param {Panel} panel - As saved, with the channel it should be in
 * @param {{ channelId: string, messageId: string | null } | null} previous - Where it was posted before
 * @returns {Promise<{ ok: boolean, panel?: Panel, error?: string }>} error is set when not ok
 */
export async function publishPanel(guild, panel, previous) {
    const result = await publishMessage(guild, {
        channelId: panel.channelId,
        previous,
        message: await panelMessage(guild, panel),
        label: 'Reaction Roles',
    });
    if (!result.ok) return { ok: false, error: result.error };
    if (result.messageId === panel.messageId) return { ok: true, panel };

    const updated = await ReactionRolePanel.findByIdAndUpdate(
        panel._id,
        { $set: { messageId: result.messageId } },
        { returnDocument: 'after' }
    ).lean();
    return { ok: true, panel: updated ?? { ...panel, messageId: result.messageId } };
}

/**
 * Deletes a panel's message, if it's still there.
 * @param {import('discord.js').Guild} guild
 * @param {{ channelId: string, messageId?: string | null }} where
 */
export const removePanelMessage = removePostedMessage;
