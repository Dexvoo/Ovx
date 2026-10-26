import { PermissionFlagsBits } from 'discord.js';

/**
 * @typedef {'ban' | 'unban' | 'kick' | 'mute' | 'unmute' | 'purge' | 'nickname' | 'warn' | 'unwarn' | 'history'
 *   | 'note' | 'lock' | 'unlock' | 'slowmode'} ModerationAction
 */

/** What both the moderator and Ovx need for each action. */
export const ACTION_PERMISSIONS = Object.freeze({
    ban: [PermissionFlagsBits.BanMembers],
    unban: [PermissionFlagsBits.BanMembers],
    kick: [PermissionFlagsBits.KickMembers],
    mute: [PermissionFlagsBits.ModerateMembers],
    unmute: [PermissionFlagsBits.ModerateMembers],
    purge: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory],
    nickname: [PermissionFlagsBits.ManageNicknames],
    warn: [PermissionFlagsBits.ModerateMembers],
    unwarn: [PermissionFlagsBits.ModerateMembers],
    history: [PermissionFlagsBits.ModerateMembers],
    note: [PermissionFlagsBits.ModerateMembers],
    lock: [PermissionFlagsBits.ManageChannels],
    unlock: [PermissionFlagsBits.ManageChannels],
    slowmode: [PermissionFlagsBits.ManageChannels],
});

/** What Ovx needs on top: changing a channel's permissions takes Manage Permissions (Manage Roles) there. */
export const BOT_EXTRA_PERMISSIONS = Object.freeze({
    lock: [PermissionFlagsBits.ManageRoles],
    unlock: [PermissionFlagsBits.ManageRoles],
});

/** Actions Ovx only records, so it needs no permission of its own for them. */
export const RECORD_ONLY_ACTIONS = new Set(['warn', 'unwarn', 'history', 'note']);

/** Discord's longest timeout is 28 days. */
export const MAX_MUTE_MS = 28 * 24 * 60 * 60_000;
export const MIN_MUTE_MS = 10_000;
/** Discord allows 512 characters of audit log reason; "By @username: " takes some of it. */
export const REASON_MAX = 400;

/**
 * Whether the moderator may do this to the target, and whether Ovx can. Returns the reason it can't
 * (a translation key under commands.moderation), or null if it's allowed.
 *
 * Works on what Discord reports right now: role positions and the owner, never anything cached by Ovx.
 *
 * @param {ModerationAction} action
 * @param {{ moderator: import('discord.js').GuildMember, target: import('discord.js').GuildMember,
 *   me: import('discord.js').GuildMember, ownerId: string }} people
 * @returns {string | null}
 */
export function checkTarget(action, { moderator, target, me, ownerId }) {
    if (target.id === me.id) return action === 'nickname' ? 'use_dashboard_nickname' : 'target_bot_self';
    // Changing your own nickname is fine; punishing yourself isn't
    if (target.id === moderator.id && action !== 'nickname') return 'target_self';
    if (target.id === ownerId) return 'target_owner';

    const targetPosition = target.roles.highest.position;
    if (moderator.id !== ownerId && target.id !== moderator.id && targetPosition >= moderator.roles.highest.position) {
        return 'target_higher_than_you';
    }
    // A warning is only recorded, so Ovx's own role doesn't matter
    if (action !== 'warn' && targetPosition >= me.roles.highest.position) return 'target_higher_than_bot';

    // Discord doesn't let anyone time out an administrator
    if (action === 'mute' && target.permissions.has(PermissionFlagsBits.Administrator)) return 'target_admin';
    return null;
}

/**
 * The audit log reason, so the server's audit log (and Ovx's punishment logs) show who really did it.
 * @param {import('discord.js').User} moderator
 * @param {string | null} reason
 */
export function auditReason(moderator, reason) {
    return `By @${moderator.username}: ${reason ?? 'No reason given'}`.slice(0, 512);
}

/**
 * Reads an audit log reason written by auditReason back into its parts.
 * @param {string | null | undefined} text
 * @returns {{ moderatorName: string, reason: string } | null} null if it wasn't written by Ovx
 */
export function parseAuditReason(text) {
    // Discord usernames are 2-32 of a-z, 0-9, _ and .
    const match = text?.match(/^By @([a-z0-9_.]{2,32}): ([\s\S]*)$/);
    return match ? { moderatorName: match[1], reason: match[2] } : null;
}

const UNITS = {
    s: 1000,
    sec: 1000,
    secs: 1000,
    second: 1000,
    seconds: 1000,
    m: 60_000,
    min: 60_000,
    mins: 60_000,
    minute: 60_000,
    minutes: 60_000,
    h: 3_600_000,
    hr: 3_600_000,
    hrs: 3_600_000,
    hour: 3_600_000,
    hours: 3_600_000,
    d: 86_400_000,
    day: 86_400_000,
    days: 86_400_000,
    w: 604_800_000,
    week: 604_800_000,
    weeks: 604_800_000,
};

/**
 * Reads a duration like "10m", "1h 30m", "2 days" or "1w". A plain number means minutes.
 * @param {string} text
 * @returns {number | null} Milliseconds, or null if it isn't a duration
 */
export function parseDuration(text) {
    const input = text.trim().toLowerCase();
    if (/^\d+(\.\d+)?$/.test(input)) return Math.round(Number(input) * 60_000);

    const parts = [...input.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/g)];
    // Everything typed must be part of a number + unit pair, so "5 potatoes" or "1h lol" are rejected
    const leftover = input.replace(/(\d+(?:\.\d+)?)\s*([a-z]+)/g, '').replace(/[\s,]|and/g, '');
    if (parts.length === 0 || leftover) return null;

    let total = 0;
    for (const [, amount, unit] of parts) {
        if (!UNITS[unit]) return null;
        total += Number(amount) * UNITS[unit];
    }
    return Math.round(total);
}

/** @type {[string, number][]} */
const NAMED_UNITS = [
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1000],
];

/**
 * "1 day 2 hours": the two largest units, rounded down.
 * @param {number} ms
 */
export function formatDuration(ms) {
    const parts = [];
    let rest = ms;
    for (const [name, size] of NAMED_UNITS) {
        const count = Math.floor(rest / size);
        if (count === 0) continue;
        parts.push(`${count} ${name}${count === 1 ? '' : 's'}`);
        rest -= count * size;
        if (parts.length === 2) break;
    }
    return parts.join(' ') || '0 seconds';
}
