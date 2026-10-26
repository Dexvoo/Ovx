import { ChannelType, EmbedBuilder, OverwriteType, PermissionFlagsBits } from 'discord.js';
import Ticket_Config_Cache from '../cache/ticketConfig.cache.js';
import { Ticket } from '../models/ticket.js';
import { CATEGORY_PERMISSIONS, MEMBER_ACCESS } from './access.js';
import { TICKET_DEFAULTS, ticketControls, ticketLabel } from './components.js';
import { findTicketType, staffRolesFor } from './ticketTypes.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { LogData } from '../../../shared/utils/logger.js';

/** People whose ticket is being created right now, so a double click can't open two. */
const creating = new Set();

/**
 * @typedef {{ ok: true, channel: import('discord.js').TextChannel } |
 *   { ok: false, reason: 'disabled' | 'unknown_type' | 'not_allowed' | 'no_category' | 'bot_permissions' | 'limit' | 'busy',
 *     missing?: string[], limit?: number }} OpenResult
 */

/**
 * Opens a ticket for a member: a private channel only they and staff can see.
 * @param {import('discord.js').GuildMember} member
 * @param {string | null} [typeId] - Which ticket type (null: the first one)
 * @returns {Promise<OpenResult>}
 */
export async function openTicket(member, typeId = null) {
    const { guild } = member;
    const key = `${guild.id}:${member.id}`;
    if (creating.has(key)) return { ok: false, reason: 'busy' };
    creating.add(key);

    try {
        const config = await Ticket_Config_Cache.get(guild.id);
        if (!config.enabled) return { ok: false, reason: 'disabled' };

        const type = findTicketType(config, typeId);
        if (!type) return { ok: false, reason: 'unknown_type' };
        const staffRoleIds = staffRolesFor(config, type).filter((roleId) => guild.roles.cache.has(roleId));

        // Some types are only for certain roles (staff can always open them)
        const allowed = type.allowedRoleIds?.filter((roleId) => guild.roles.cache.has(roleId)) ?? [];
        const isStaffMember =
            member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
            staffRoleIds.some((roleId) => member.roles?.cache.has(roleId));
        if (allowed.length > 0 && !isStaffMember && !allowed.some((roleId) => member.roles?.cache.has(roleId))) {
            return { ok: false, reason: 'not_allowed' };
        }

        const categoryId = type.categoryId ?? config.categoryId;
        const category = categoryId ? guild.channels.cache.get(categoryId) : null;
        if (category?.type !== ChannelType.GuildCategory) return { ok: false, reason: 'no_category' };

        const missing = guild.members.me?.permissionsIn(category).missing(CATEGORY_PERMISSIONS) ?? [];
        if (missing.length > 0) return { ok: false, reason: 'bot_permissions', missing };

        if ((await countOpenTickets(guild, member.id)) >= config.maxOpenPerUser) {
            return { ok: false, reason: 'limit', limit: config.maxOpenPerUser };
        }

        const number = await Ticket_Config_Cache.nextTicketNumber(guild.id);
        const label = ticketLabel(number);
        const channel = await guild.channels.create({
            name: `${type.channelPrefix ?? 'ticket'}-${label}`,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `${type.label} #${label}, opened by @${member.user.username} (${member.id})`,
            reason: `${type.label} #${label} opened by ${member.user.username} (${member.id})`,
            permissionOverwrites: [
                { id: guild.id, type: OverwriteType.Role, deny: ['ViewChannel'] },
                {
                    id: guild.members.me.id,
                    type: OverwriteType.Member,
                    allow: [
                        'ViewChannel',
                        'SendMessages',
                        'ReadMessageHistory',
                        'EmbedLinks',
                        'AttachFiles',
                        'ManageChannels',
                    ],
                },
                { id: member.id, type: OverwriteType.Member, allow: accessList() },
                ...staffRoleIds.map((roleId) => ({ id: roleId, type: OverwriteType.Role, allow: accessList() })),
            ],
        });

        // If anything after creating the channel fails, the half-made ticket is removed again
        try {
            const ticket = { locked: false, claimedBy: null };
            const embed = new EmbedBuilder()
                .setColor(await brandColour(guild.id))
                .setTitle(`${type.emoji ? `${type.emoji} ` : ''}${type.label} #${label}`)
                .setDescription(type.openMessage ?? config.openMessage ?? TICKET_DEFAULTS.openMessage)
                .setFooter({ text: `Opened by ${member.user.username}` })
                .setTimestamp();

            const pinged = config.pingStaff ? staffRoleIds : [];
            const control = await channel.send({
                content: [`<@${member.id}>`, ...pinged.map((roleId) => `<@&${roleId}>`)].join(' '),
                embeds: [embed],
                components: [ticketControls(ticket)],
                // Only the owner and (if switched on) the staff roles are pinged
                allowedMentions: { users: [member.id], roles: pinged },
            });

            await Ticket.create({
                guildId: guild.id,
                number,
                channelId: channel.id,
                controlMessageId: control.id,
                ownerId: member.id,
                typeId: type.id,
            });
            return { ok: true, channel };
        } catch (error) {
            await channel.delete('Ticket could not be set up').catch(() => {});
            throw error;
        }
    } finally {
        creating.delete(key);
    }
}

/**
 * How many tickets a member has open. Tickets whose channel was deleted while the bot was offline are
 * marked closed here, so they don't count against the limit forever.
 * @param {import('discord.js').Guild} guild
 * @param {string} ownerId
 */
async function countOpenTickets(guild, ownerId) {
    const tickets = await Ticket.find({ guildId: guild.id, ownerId, status: { $in: ['open', 'closing'] } }).lean();
    const gone = tickets.filter((ticket) => !guild.channels.cache.has(ticket.channelId));
    if (gone.length > 0) {
        await Ticket.updateMany(
            { _id: { $in: gone.map((ticket) => ticket._id) } },
            { $set: { status: 'closed', closedAt: new Date(), closeReason: 'Channel deleted' } }
        );
        LogData(
            'Tickets',
            `Guild: ${guild.name} | Marked ${gone.length} ticket(s) with deleted channels as closed`,
            'info'
        );
    }
    return tickets.length - gone.length;
}

/** @returns {import('discord.js').PermissionResolvable[]} */
function accessList() {
    return /** @type {import('discord.js').PermissionResolvable[]} */ (
        Object.keys(MEMBER_ACCESS).filter((permission) => MEMBER_ACCESS[permission])
    );
}
