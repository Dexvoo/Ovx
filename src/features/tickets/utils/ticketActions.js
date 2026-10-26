import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import Ticket_Config_Cache from '../cache/ticketConfig.cache.js';
import { findOpenTicket, isStaff } from './access.js';
import { closeConfirmation } from './components.js';
import { openTicket } from './openTicket.js';
import { closeTicket, DELETE_DELAY_MS } from './closeTicket.js';
import { setLocked, setClaimedBy, addMember, removeMember } from './manageTicket.js';
import { replyError } from '../../../shared/utils/commandChecks.js';

/**
 * Everything a ticket action can do, shared by the buttons (events/ticketButtons.js) and /ticket.
 * Each one checks permissions itself and replies to the interaction.
 *
 * @typedef {import('discord.js').ChatInputCommandInteraction<'cached'> | import('discord.js').ButtonInteraction<'cached'>} TicketInteraction
 */

/**
 * @param {TicketInteraction} interaction
 * @param {string} key - Under tickets.* in the locale files
 * @param {Record<string, any>} [args]
 */
function t(interaction, key, args = {}) {
    return interaction.client.utils.Translate(`tickets.${key}`, interaction.locale, args);
}

/** A public message in the ticket, in the server's embed colour. */
function announce(interaction, message) {
    return interaction.client.utils.Embed(interaction, 'Brand', t(interaction, 'title'), message);
}

/** A private confirmation. */
function confirm(interaction, message) {
    return interaction.client.utils.Embed(interaction, 'Brand', t(interaction, 'title'), message, {
        flags: MessageFlags.Ephemeral,
    });
}

/**
 * The ticket for the channel the interaction happened in, with the server's config and whether the user is staff.
 * Replies with an error and returns null if this isn't an open ticket.
 * @param {TicketInteraction} interaction
 */
async function ticketContext(interaction) {
    const [config, ticket] = await Promise.all([
        Ticket_Config_Cache.get(interaction.guildId),
        findOpenTicket(interaction.channelId),
    ]);
    if (!ticket || !interaction.channel?.isTextBased() || interaction.channel.isThread()) {
        await replyError(interaction, t(interaction, 'not_ticket'));
        return null;
    }
    return {
        config,
        ticket,
        channel: /** @type {import('discord.js').TextChannel} */ (interaction.channel),
        staff: isStaff(interaction.member, config, ticket.typeId ?? null),
    };
}

/** @param {TicketInteraction} interaction */
const auditReason = (interaction, action) => `${action} by ${interaction.user.username} (${interaction.user.id})`;

/**
 * Opens a ticket for the person who clicked a panel button.
 * @param {TicketInteraction} interaction
 * @param {string | null} [typeId] - From the button (null: the first type)
 */
export async function createAction(interaction, typeId = null) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = /** @type {any} */ (await openTicket(interaction.member, typeId));

    if (result.ok) return confirm(interaction, t(interaction, 'created', { channel: result.channel.toString() }));
    const args = { perms: result.missing?.join(', '), limit: result.limit };
    return replyError(interaction, t(interaction, result.reason, args));
}

/**
 * Asks before closing (from the Close button). The command closes straight away instead.
 * @param {import('discord.js').ButtonInteraction<'cached'>} interaction
 */
export async function askCloseAction(interaction) {
    const context = await ticketContext(interaction);
    if (!context) return;
    if (!canClose(interaction, context)) return replyError(interaction, t(interaction, 'cannot_close'));

    return interaction.reply({
        content: t(interaction, 'close_confirm'),
        components: [closeConfirmation()],
        flags: MessageFlags.Ephemeral,
    });
}

/**
 * Hides the "are you sure" message when Cancel is clicked.
 * @param {import('discord.js').ButtonInteraction<'cached'>} interaction
 */
export function cancelCloseAction(interaction) {
    return interaction.update({ content: t(interaction, 'close_cancelled'), components: [] });
}

/**
 * Closes the ticket.
 * @param {TicketInteraction} interaction
 * @param {string | null} [reason]
 */
export async function closeAction(interaction, reason = null) {
    const context = await ticketContext(interaction);
    if (!context) return;
    if (!canClose(interaction, context)) return replyError(interaction, t(interaction, 'cannot_close'));

    // The confirmation message is replaced, so it can't be clicked twice
    if (interaction.isButton()) await interaction.update({ content: t(interaction, 'closing'), components: [] });
    else await interaction.deferReply();

    const result = /** @type {any} */ (
        await closeTicket({
            channel: context.channel,
            ticket: context.ticket,
            config: context.config,
            closedBy: interaction.member,
            reason,
        })
    );

    if (!result.ok) {
        const message = t(interaction, result.reason, { detail: result.detail ?? '' });
        return interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
    }

    const closedMessage = t(interaction, 'closed', {
        user: interaction.user.toString(),
        seconds: DELETE_DELAY_MS / 1000,
    });
    if (interaction.isButton()) return context.channel.send({ content: closedMessage, allowedMentions: { parse: [] } });
    return interaction.editReply({ content: closedMessage, allowedMentions: { parse: [] } });
}

/**
 * @param {TicketInteraction} interaction
 * @param {boolean} locked
 */
export async function lockAction(interaction, locked) {
    const context = await ticketContext(interaction);
    if (!context) return;
    if (!context.staff) return replyError(interaction, t(interaction, 'staff_only'));
    if (context.ticket.locked === locked) {
        return replyError(interaction, t(interaction, locked ? 'already_locked' : 'not_locked'));
    }

    await setLocked(context.channel, context.ticket, locked, auditReason(interaction, locked ? 'Locked' : 'Unlocked'));
    return announce(
        interaction,
        t(interaction, locked ? 'locked' : 'unlocked', {
            user: interaction.user.toString(),
            owner: `<@${context.ticket.ownerId}>`,
        })
    );
}

/**
 * Claims the ticket, or unclaims it if you already have it.
 * Someone else's claim can only be taken over by a server manager.
 * @param {TicketInteraction} interaction
 */
export async function claimAction(interaction) {
    const context = await ticketContext(interaction);
    if (!context) return;
    if (!context.staff) return replyError(interaction, t(interaction, 'staff_only'));

    const { ticket } = context;
    if (ticket.claimedBy === interaction.user.id) {
        await setClaimedBy(context.channel, ticket, null);
        return announce(interaction, t(interaction, 'unclaimed', { user: interaction.user.toString() }));
    }
    if (ticket.claimedBy && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return replyError(interaction, t(interaction, 'claimed_by_other', { user: `<@${ticket.claimedBy}>` }));
    }

    await setClaimedBy(context.channel, ticket, interaction.user.id);
    return announce(interaction, t(interaction, 'claimed', { user: interaction.user.toString() }));
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 * @param {import('discord.js').User} user
 */
export async function addAction(interaction, user) {
    const context = await ticketContext(interaction);
    if (!context) return;
    if (!context.staff) return replyError(interaction, t(interaction, 'staff_only'));

    const { ticket } = context;
    if (user.bot) return replyError(interaction, t(interaction, 'cannot_add_bot'));
    if (user.id === ticket.ownerId || ticket.addedUserIds.includes(user.id)) {
        return replyError(interaction, t(interaction, 'already_added', { user: user.toString() }));
    }
    if (!(await interaction.guild.members.fetch(user.id).catch(() => null))) {
        return replyError(interaction, t(interaction, 'not_member', { user: user.toString() }));
    }

    await addMember(context.channel, ticket, user.id, auditReason(interaction, 'Added to ticket'));
    return announce(interaction, t(interaction, 'added', { user: user.toString(), by: interaction.user.toString() }));
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 * @param {import('discord.js').User} user
 */
export async function removeAction(interaction, user) {
    const context = await ticketContext(interaction);
    if (!context) return;
    if (!context.staff) return replyError(interaction, t(interaction, 'staff_only'));

    const { ticket } = context;
    if (user.id === ticket.ownerId) return replyError(interaction, t(interaction, 'cannot_remove_owner'));
    if (!ticket.addedUserIds.includes(user.id)) {
        return replyError(interaction, t(interaction, 'not_added', { user: user.toString() }));
    }

    await removeMember(context.channel, ticket, user.id, auditReason(interaction, 'Removed from ticket'));
    return announce(interaction, t(interaction, 'removed', { user: user.toString(), by: interaction.user.toString() }));
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 * @param {string} name
 */
export async function renameAction(interaction, name) {
    const context = await ticketContext(interaction);
    if (!context) return;
    if (!context.staff) return replyError(interaction, t(interaction, 'staff_only'));

    // Discord channel names: lowercase, dashes instead of spaces
    const cleaned = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}_-]/gu, '')
        .slice(0, 90);
    if (!cleaned) return replyError(interaction, t(interaction, 'bad_name'));

    // Discord only allows two renames per channel every 10 minutes; past that, the rename waits
    await interaction.deferReply();
    await context.channel.setName(cleaned, auditReason(interaction, 'Renamed'));
    return interaction.editReply({ content: t(interaction, 'renamed', { name: `#${cleaned}` }) });
}

/**
 * @param {TicketInteraction} interaction
 * @param {{ ticket: { ownerId: string }, config: { ownerCanClose: boolean }, staff: boolean }} context
 */
function canClose(interaction, { ticket, config, staff }) {
    return staff || (config.ownerCanClose && ticket.ownerId === interaction.user.id);
}
