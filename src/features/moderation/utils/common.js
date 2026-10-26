import { EmbedBuilder, MessageFlags } from 'discord.js';
import { ACTION_PERMISSIONS, BOT_EXTRA_PERMISSIONS, RECORD_ONLY_ACTIONS, checkTarget } from './checks.js';
import { createCase } from './cases.js';
import { replyError } from '../../../shared/utils/commandChecks.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { getLogChannel } from '../../logging/utils/logChannel.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * @typedef {import('./checks.js').ModerationAction} ModerationAction
 * @typedef {import('discord.js').ChatInputCommandInteraction<'cached'>} Interaction
 */

/**
 * Translates a key under commands.moderation for whoever ran the command.
 * @param {Interaction} interaction
 * @param {string} key
 * @param {Record<string, unknown>} [args]
 */
export function t(interaction, key, args = {}) {
    return interaction.client.utils.Translate(`commands.moderation.${key}`, interaction.locale, args);
}

/** Readable permission names, e.g. "Ban Members". */
function permissionNames(permissions) {
    return permissions.flat().map((name) => String(name).replace(/([a-z])([A-Z])/g, '$1 $2'));
}

/**
 * Checks the moderator and Ovx both have the permissions for this action, replying with what's missing if not.
 * Checked in this channel (or the one the action is for), since channel overwrites can change who may do what there.
 * @param {Interaction} interaction
 * @param {ModerationAction} action
 * @param {Interaction | import('discord.js').GuildBasedChannel} [where] - The channel the action is for
 * @returns {Promise<boolean>}
 */
export async function hasPermissions(interaction, action, where = interaction) {
    const { client, member, guild } = interaction;
    const needed = ACTION_PERMISSIONS[action];

    const [userOk, userMissing] = client.utils.PermissionCheck(where, needed, member);
    if (!userOk) {
        await replyError(
            interaction,
            t(interaction, 'user_missing_perms', { perms: permissionNames(userMissing).join(', ') })
        );
        return false;
    }
    if (RECORD_ONLY_ACTIONS.has(action)) return true;
    const botNeeded = [...needed, ...(BOT_EXTRA_PERMISSIONS[action] ?? [])];
    const [botOk, botMissing] = client.utils.PermissionCheck(where, botNeeded, guild.members.me);
    if (!botOk) {
        await replyError(
            interaction,
            t(interaction, 'bot_missing_perms', { perms: permissionNames(botMissing).join(', ') })
        );
        return false;
    }
    return true;
}

/**
 * The member chosen in the "user" option, after checking this action may be used on them.
 * Replies with the reason and returns null if not.
 * @param {Interaction} interaction
 * @param {ModerationAction} action
 * @returns {Promise<import('discord.js').GuildMember | null>}
 */
export async function targetMember(interaction, action) {
    const { guild, member, options } = interaction;
    const user = options.getUser('user', true);
    const target = options.getMember('user') ?? (await guild.members.fetch(user.id).catch(() => null));
    if (!target) {
        await replyError(interaction, t(interaction, 'not_member', { user: user.toString() }));
        return null;
    }

    const problem = checkTarget(action, { moderator: member, target, me: guild.members.me, ownerId: guild.ownerId });
    if (problem) {
        await replyError(interaction, t(interaction, problem, { user: user.toString() }));
        return null;
    }
    return target;
}

/**
 * Lets the member know what happened and why. Returns false if their DMs are closed.
 * Moderators aren't named, so members can't go after them.
 * @param {Interaction} interaction
 * @param {import('discord.js').User} user
 * @param {'ban' | 'tempban' | 'kick' | 'mute' | 'warn'} action
 * @param {{ reason: string | null, duration?: string }} details
 */
export async function notifyMember(interaction, user, action, { reason, duration }) {
    const { guild } = interaction;
    // Sent in the server's language, not the moderator's
    const locale = guild.preferredLocale;
    const translate = (key, args) => interaction.client.utils.Translate(`commands.moderation.${key}`, locale, args);

    const embed = new EmbedBuilder()
        .setColor(await brandColour(guild.id))
        .setDescription(translate(`dm_${action}`, { server: guild.name, duration }))
        .addFields({ name: translate('reason_field'), value: reason ?? translate('no_reason') });
    try {
        await user.send({ embeds: [embed] });
        return true;
    } catch {
        return false;
    }
}

/**
 * The private success reply, with the case number and a note when the member couldn't be messaged.
 * @param {Interaction} interaction
 * @param {string} description
 * @param {{ dmFailed?: boolean, caseNumber?: number | null }} [options]
 */
export function replySuccess(interaction, description, { dmFailed = false, caseNumber = null } = {}) {
    const notes = [];
    if (caseNumber) notes.push(t(interaction, 'case_line', { number: caseNumber }));
    if (dmFailed) notes.push(t(interaction, 'dm_failed'));
    const text = [description, ...notes.map((note) => `-# ${note}`)].join('\n');
    return interaction.client.utils.Embed(interaction, 'Brand', t(interaction, 'title'), text, {
        flags: MessageFlags.Ephemeral,
    });
}

/**
 * Adds the action to the member's case history. A database problem doesn't undo the action that already
 * happened in Discord; it's logged, and the reply just has no case number.
 * @param {Interaction} interaction
 * @param {import('../models/modCase.js').CaseAction} action
 * @param {import('discord.js').User} user
 * @param {{ reason?: string | null, durationMs?: number | null }} [details]
 * @returns {Promise<number | null>} The case number
 */
export async function recordCase(interaction, action, user, { reason = null, durationMs = null } = {}) {
    try {
        const saved = await createCase({
            guildId: interaction.guildId,
            action,
            user: { id: user.id, username: user.username },
            moderator: { id: interaction.user.id, username: interaction.user.username },
            reason,
            durationMs,
        });
        return saved.number;
    } catch (error) {
        LogData('Moderation', `Could not save a ${action} case in ${interaction.guildId}: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Posts to the Punishment log for actions Discord has no event for (warnings, purges).
 * Bans, kicks and timeouts are logged from Discord's own events instead.
 * @param {Interaction} interaction
 * @param {import('discord.js').ColorResolvable & keyof typeof import('discord.js').Colors} colour
 * @param {string} kind - Key prefix under logs.punishment, e.g. "warn" for warn_title/warn_description
 * @param {Record<string, unknown>} args
 */
export async function postPunishmentLog(interaction, colour, kind, args) {
    const { guild, client } = interaction;
    const channel = await getLogChannel(guild, 'punishment');
    if (!channel) return;

    const locale = guild.preferredLocale;
    const translate = (key) => client.utils.Translate(`logs.punishment.${kind}_${key}`, locale, args);
    try {
        await client.utils.Embed(channel, colour, translate('title'), translate('description'), {
            timestamp: true,
            footer: args.userId ? { text: `UID: ${args.userId}` } : undefined,
        });
    } catch (error) {
        LogData('Moderation', `Could not post a ${kind} log in ${guild.id}: ${error.message}`, 'warning');
    }
}
