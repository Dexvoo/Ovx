import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Giveaway, GiveawayEntry, GiveawayConfig } from '../models/giveaway.js';
import { GIVEAWAY_BUTTONS } from './message.js';
import { isGiveawayId, scheduleRefresh } from './lifecycle.js';
import User_Levels_Cache from '../../levels/cache/userLevels.cache.js';
import { hasVotedRecently, votesEnabled, voteUrl } from '../../votes/utils/votes.js';

const DUPLICATE_KEY = 11000;

/**
 * Whether a member can start and manage giveaways: Manage Server, or one of the server's giveaway manager roles.
 * @param {import('discord.js').GuildMember} member
 */
export async function canManageGiveaways(member) {
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    const config = await GiveawayConfig.findOne({ guildId: member.guild.id }, { managerRoleIds: 1 }).lean();
    return (config?.managerRoleIds ?? []).some((roleId) => member.roles.cache.has(roleId));
}

/**
 * Why a member can't enter, or null if they can.
 * @param {import('discord.js').GuildMember} member
 * @param {import('../models/giveaway.js').GiveawayType} giveaway
 * @param {(key: string, vars?: object) => string} t
 */
export async function entryBlocker(member, giveaway, t) {
    const { roleIds, minLevel } = giveaway.requirements ?? { roleIds: [], minLevel: 0 };
    if (roleIds.length > 0 && !roleIds.some((roleId) => member.roles.cache.has(roleId))) {
        return t('missing_role', { roles: roleIds.map((id) => `<@&${id}>`).join(', ') });
    }
    if (minLevel > 0) {
        const level = (await User_Levels_Cache.get(member.guild.id, member.id))?.level ?? 0;
        if (level < minLevel) return t('low_level', { level: minLevel, current: level });
    }
    return null;
}

/**
 * @param {import('discord.js').ButtonInteraction<'cached'>} interaction
 * @param {string} giveawayId
 * @param {string} content
 * @param {{ leave?: boolean, vote?: number }} [buttons]
 */
function replyPrivately(interaction, giveawayId, content, { leave = false, vote = 0 } = {}) {
    const t = (key, vars) => interaction.client.utils.Translate(`giveaways.entry.${key}`, interaction.locale, vars);
    const row = /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder());
    if (leave) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`${GIVEAWAY_BUTTONS.leave}:${giveawayId}`)
                .setStyle(ButtonStyle.Danger)
                .setLabel(t('leave_button'))
        );
    }
    if (vote > 0) {
        row.addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(voteUrl())
                .setLabel(t('vote_button', { count: vote }))
        );
    }
    return interaction.reply({
        content,
        components: row.components.length > 0 ? [row] : [],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
}

/**
 * The Enter button. Clicking it again after entering shows your entries (and picks up a vote made since).
 * @param {import('discord.js').ButtonInteraction<'cached'>} interaction
 * @param {string} giveawayId
 */
export async function enterGiveaway(interaction, giveawayId) {
    const t = (key, vars) => interaction.client.utils.Translate(`giveaways.entry.${key}`, interaction.locale, vars);
    if (!isGiveawayId(giveawayId)) return replyPrivately(interaction, giveawayId, t('closed'));

    const giveaway = await Giveaway.findOne({ _id: giveawayId, guildId: interaction.guildId }).lean();
    if (giveaway?.status !== 'running') return replyPrivately(interaction, giveawayId, t('closed'));

    const userId = interaction.user.id;
    const bonus = giveaway.voteBonus > 0 && votesEnabled() ? giveaway.voteBonus : 0;
    const voted = bonus > 0 && (await hasVotedRecently(userId));
    const entries = 1 + (voted ? bonus : 0);
    const voteHint = bonus > 0 && !voted ? bonus : 0;

    const existing = await GiveawayEntry.findOne({ giveawayId: giveaway._id, userId }).lean();
    if (existing) {
        // They voted after entering: their bonus is added now
        if (entries > existing.entries) {
            await GiveawayEntry.updateOne({ _id: existing._id }, { $set: { entries } });
            return replyPrivately(interaction, giveawayId, t('bonus_added', { entries }), { leave: true });
        }
        return replyPrivately(interaction, giveawayId, t('already', { entries: existing.entries }), {
            leave: true,
            vote: voteHint,
        });
    }

    const blocker = await entryBlocker(interaction.member, giveaway, t);
    if (blocker) return replyPrivately(interaction, giveawayId, blocker);

    try {
        await GiveawayEntry.create({ giveawayId: giveaway._id, guildId: giveaway.guildId, userId, entries });
    } catch (error) {
        // A double click: the other click already entered them
        if (error?.code === DUPLICATE_KEY)
            return replyPrivately(interaction, giveawayId, t('already', { entries }), { leave: true });
        throw error;
    }
    await Giveaway.updateOne({ _id: giveaway._id }, { $inc: { entrantCount: 1 } });
    scheduleRefresh(interaction.guild, giveawayId);

    const message = voted ? t('entered_bonus', { entries }) : t('entered');
    return replyPrivately(interaction, giveawayId, message, { leave: true, vote: voteHint });
}

/**
 * The Leave button, shown privately after entering.
 * @param {import('discord.js').ButtonInteraction<'cached'>} interaction
 * @param {string} giveawayId
 */
export async function leaveGiveaway(interaction, giveawayId) {
    const t = (key, vars) => interaction.client.utils.Translate(`giveaways.entry.${key}`, interaction.locale, vars);
    if (!isGiveawayId(giveawayId)) return interaction.update({ content: t('closed'), components: [] });

    const giveaway = await Giveaway.findOne({ _id: giveawayId, guildId: interaction.guildId }).lean();
    if (giveaway?.status !== 'running') return interaction.update({ content: t('closed'), components: [] });

    const { deletedCount } = await GiveawayEntry.deleteOne({ giveawayId: giveaway._id, userId: interaction.user.id });
    if (deletedCount > 0) {
        await Giveaway.updateOne({ _id: giveaway._id }, { $inc: { entrantCount: -1 } });
        scheduleRefresh(interaction.guild, giveawayId);
    }
    return interaction.update({ content: t('left'), components: [] });
}
