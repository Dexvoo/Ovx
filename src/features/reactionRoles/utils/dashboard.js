import { ReactionRolePanel, LegacyReactionRoles } from '../models/reactionRolePanel.js';
import { validatePanel, REACTION_ROLE_LIMITS } from './validation.js';
import { publishPanel, removePanelMessage } from './panel.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MODE_NAMES = { normal: 'Normal', unique: 'Only one', verify: 'Add only' };

/**
 * The dashboard's Reaction Roles page, run on the shard after the Manage Server check (see dashboard/shardHandlers.js).
 * @typedef {{ ok: true, data: any, changes?: string[], action?: string } | { ok: false, status: number, error: string, details?: string[] }} Result
 */

/**
 * @param {any} panel - A saved panel (lean document)
 */
export function panelView(panel) {
    return {
        id: String(panel._id),
        channelId: panel.channelId,
        posted: Boolean(panel.messageId),
        messageUrl: panel.messageId
            ? `https://discord.com/channels/${panel.guildId}/${panel.channelId}/${panel.messageId}`
            : null,
        title: panel.title,
        description: panel.description ?? null,
        colour: panel.colour ?? null,
        mode: panel.mode,
        requiredRoleId: panel.requiredRoleId ?? null,
        maxRoles: panel.maxRoles ?? 0,
        buttons: panel.buttons.map(({ roleId, label, emoji, style }) => ({ roleId, label, emoji, style })),
    };
}

/**
 * What changed, for the Web Logs.
 * @param {import('discord.js').Guild} guild
 * @param {ReturnType<typeof panelView> | null} before
 * @param {ReturnType<typeof panelView>} after
 */
function describe(guild, before, after) {
    const role = (id) => `@${guild.roles.cache.get(id)?.name ?? 'deleted-role'}`;
    const channel = (id) => `#${guild.channels.cache.get(id)?.name ?? 'deleted-channel'}`;
    const roles = (panel) => panel.buttons.map((button) => role(button.roleId));

    if (!before) {
        return [
            `"${after.title}" in ${channel(after.channelId)} (${MODE_NAMES[after.mode]}): ${roles(after).join(', ')}`,
        ];
    }
    const changes = [];
    if (before.title !== after.title) changes.push(`Title: "${before.title}" → "${after.title}"`);
    if (before.channelId !== after.channelId)
        changes.push(`Channel: ${channel(before.channelId)} → ${channel(after.channelId)}`);
    if (before.mode !== after.mode) changes.push(`Mode: ${MODE_NAMES[before.mode]} → ${MODE_NAMES[after.mode]}`);
    if (before.requiredRoleId !== after.requiredRoleId) {
        changes.push(
            `Required role: ${before.requiredRoleId ? role(before.requiredRoleId) : 'none'} → ${after.requiredRoleId ? role(after.requiredRoleId) : 'none'}`
        );
    }
    if (before.maxRoles !== after.maxRoles)
        changes.push(`Most roles: ${before.maxRoles || 'no limit'} → ${after.maxRoles || 'no limit'}`);
    const added = roles(after).filter((name) => !roles(before).includes(name));
    const removed = roles(before).filter((name) => !roles(after).includes(name));
    if (added.length) changes.push(`Roles added: ${added.join(', ')}`);
    if (removed.length) changes.push(`Roles removed: ${removed.join(', ')}`);
    if (before.description !== after.description || before.colour !== after.colour)
        changes.push('Text or colour changed');
    if (changes.length === 0 && JSON.stringify(before.buttons) !== JSON.stringify(after.buttons))
        changes.push('Buttons changed');
    return changes.map((change) => `"${after.title}": ${change}`);
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {{ op: string, panelId?: unknown, panel?: unknown }} payload
 * @param {import('../../../dashboard/validation.js').GuildContext} context
 * @returns {Promise<Result>}
 */
export async function reactionRolesDashboard(guild, payload, context) {
    const { op } = payload;

    if (op === 'list') {
        const panels = await ReactionRolePanel.find({ guildId: guild.id }).sort({ createdAt: 1 }).lean();
        const legacyCount = await LegacyReactionRoles.countDocuments({ guildId: guild.id });
        return { ok: true, data: { panels: panels.map(panelView), legacyCount } };
    }

    const panelId = typeof payload.panelId === 'string' ? payload.panelId : null;
    if (panelId !== null && !OBJECT_ID.test(panelId))
        return { ok: false, status: 404, error: 'That panel no longer exists' };
    const existing = panelId ? await ReactionRolePanel.findOne({ _id: panelId, guildId: guild.id }).lean() : null;
    if (panelId && !existing) return { ok: false, status: 404, error: 'That panel no longer exists' };

    if (op === 'delete') {
        await ReactionRolePanel.deleteOne({ _id: existing._id });
        await removePanelMessage(guild, existing);
        return {
            ok: true,
            data: { removed: panelId },
            changes: [`"${existing.title}"`],
            action: 'Deleted a reaction role panel',
        };
    }

    if (op !== 'save') return { ok: false, status: 400, error: 'Unknown reaction roles action' };

    const { panel: valid, errors } = validatePanel(payload.panel, context);
    if (!valid) return { ok: false, status: 400, error: 'Some details are not valid', details: errors };

    if (!existing) {
        const count = await ReactionRolePanel.countDocuments({ guildId: guild.id });
        if (count >= REACTION_ROLE_LIMITS.PANELS_MAX) {
            return {
                ok: false,
                status: 400,
                error: `A server can have at most ${REACTION_ROLE_LIMITS.PANELS_MAX} reaction role panels.`,
            };
        }
    }

    const saved = existing
        ? await ReactionRolePanel.findByIdAndUpdate(existing._id, { $set: valid }, { returnDocument: 'after' }).lean()
        : (await ReactionRolePanel.create({ guildId: guild.id, ...valid })).toObject();

    const published = await publishPanel(
        guild,
        saved,
        existing ? { channelId: existing.channelId, messageId: existing.messageId } : null
    );
    // Saved either way, so nothing typed is lost; the page shows it as not posted
    const view = panelView(published.ok ? published.panel : saved);
    const changes = describe(guild, existing ? panelView(existing) : null, view);
    const action = existing ? 'Updated a reaction role panel' : 'Created a reaction role panel';

    if (!published.ok) {
        return { ok: true, data: { panel: view, warning: published.error }, changes, action };
    }
    return { ok: true, data: { panel: view }, changes, action };
}
