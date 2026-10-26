import NodeCache from 'node-cache';

/** Invisible characters people put inside links to slip past filters. */
const INVISIBLE = /[\u00ad\u200b-\u200f\u2060-\u2064\ufeff]/g;
/** Discord's own invite links, whose codes can be checked against this server. */
const DISCORD_INVITE = /(?:[\w-]+\.)?discord(?:app)?\.com\/invite\/([\w-]{2,32})|discord\.gg\/([\w-]{2,32})/gi;
/** Invite redirect sites, which can't be checked, so they're always blocked. */
const OTHER_INVITE = /\b(?:discord\.me|discord\.io|dsc\.gg|invite\.gg|discord\.link)\/[\w-]{2,}/gi;

/**
 * Text as a filter should read it: invisible characters, Markdown escapes and spaces around dots and slashes
 * removed, so "discord . gg / abc" and "discord\.gg/abc" are still caught.
 * @param {string} text
 */
export function normalise(text) {
    return text
        .replace(INVISIBLE, '')
        .replace(/\\/g, '')
        .replace(/\s*([./])\s*/g, '$1');
}

/**
 * The invites in some text.
 * @param {string} text
 * @returns {{ codes: string[], other: boolean }} codes: Discord invite codes; other: an invite on a redirect site
 */
export function findInvites(text) {
    if (!text) return { codes: [], other: false };
    const clean = normalise(text);
    const codes = [...clean.matchAll(DISCORD_INVITE)].map((match) => match[1] ?? match[2]);
    OTHER_INVITE.lastIndex = 0;
    return { codes: [...new Set(codes)], other: OTHER_INVITE.test(clean) };
}

/** Invite code → the server it's for ('' when it couldn't be found), so each code is only looked up once an hour */
const inviteServers = new NodeCache({ stdTTL: 60 * 60, checkperiod: 10 * 60, maxKeys: 10_000 });

/**
 * Whether an invite code is for this server: its vanity URL, or an invite Discord says is for it.
 * @param {import('discord.js').Guild} guild
 * @param {string} code
 */
export async function isOwnInvite(guild, code) {
    if (guild.vanityURLCode && guild.vanityURLCode.toLowerCase() === code.toLowerCase()) return true;

    let serverId = inviteServers.get(code);
    if (serverId === undefined) {
        const invite = await guild.client.fetchInvite(code).catch(() => null);
        serverId = invite?.guild?.id ?? '';
        try {
            inviteServers.set(code, serverId);
        } catch {
            // The cache is full (someone posting thousands of codes): just don't remember this one
        }
    }
    return serverId === guild.id;
}

/**
 * Whether a message has an invite that isn't allowed.
 * @param {import('discord.js').Guild} guild
 * @param {string} content
 * @param {boolean} allowOwnInvites
 */
export async function hasBlockedInvite(guild, content, allowOwnInvites) {
    const { codes, other } = findInvites(content);
    if (other) return true;
    if (codes.length === 0) return false;
    if (!allowOwnInvites) return true;
    for (const code of codes) {
        if (!(await isOwnInvite(guild, code))) return true;
    }
    return false;
}
