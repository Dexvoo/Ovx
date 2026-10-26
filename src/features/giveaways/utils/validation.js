import { parseDuration, formatDuration } from '../../moderation/utils/checks.js';

export const GIVEAWAY_LIMITS = Object.freeze({
    PRIZE_MAX: 200,
    DESCRIPTION_MAX: 1000,
    WINNERS_MAX: 20,
    ROLES_MAX: 5,
    LEVEL_MAX: 1000,
    VOTE_BONUS_MAX: 5,
    MIN_DURATION_MS: 60_000,
    MAX_DURATION_MS: 60 * 24 * 60 * 60 * 1000,
    MAX_SCHEDULE_AHEAD_MS: 90 * 24 * 60 * 60 * 1000,
    /** Running and scheduled giveaways at once, per server */
    ACTIVE_MAX: 25,
    MANAGER_ROLES_MAX: 5,
    /** Ended and cancelled giveaways (and their entries) are deleted after this, so they can be rerolled until then */
    KEEP_DAYS: 30,
});

/**
 * What the validator needs to know about the server.
 * @typedef {Object} GiveawayContext
 * @property {Set<string>} textChannelIds - Channels Ovx can post embeds in
 * @property {Set<string>} roleIds - Roles that exist (not @everyone)
 */

/**
 * @typedef {Object} GiveawayInput
 * @property {unknown} prize
 * @property {unknown} [description]
 * @property {unknown} channelId
 * @property {unknown} [winnerCount]
 * @property {unknown} duration - e.g. "1d 12h"
 * @property {unknown} [startsAt] - ISO date to schedule it, or empty to start now
 * @property {unknown} [roleIds]
 * @property {unknown} [minLevel]
 * @property {unknown} [voteBonus]
 */

/**
 * Checks a new giveaway, from the slash command or the dashboard.
 * @param {GiveawayInput} input
 * @param {GiveawayContext} context
 * @param {Date} [now]
 */
export function validateGiveaway(input, context, now = new Date()) {
    /** @type {string[]} */
    const errors = [];
    const data = input && typeof input === 'object' ? input : /** @type {GiveawayInput} */ ({});
    const L = GIVEAWAY_LIMITS;

    const prize = typeof data.prize === 'string' ? data.prize.trim() : '';
    if (!prize) errors.push('Enter a prize.');
    else if (prize.length > L.PRIZE_MAX) errors.push(`The prize can be at most ${L.PRIZE_MAX} characters.`);

    const description = typeof data.description === 'string' ? data.description.trim() : '';
    if (description.length > L.DESCRIPTION_MAX) {
        errors.push(`The description can be at most ${L.DESCRIPTION_MAX} characters.`);
    }

    const channelId = typeof data.channelId === 'string' ? data.channelId : '';
    if (!context.textChannelIds.has(channelId)) errors.push('Choose a text channel Ovx can post in.');

    const winnerCount = data.winnerCount === undefined || data.winnerCount === null ? 1 : Number(data.winnerCount);
    if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > L.WINNERS_MAX) {
        errors.push(`The number of winners must be between 1 and ${L.WINNERS_MAX}.`);
    }

    const durationMs = typeof data.duration === 'string' ? parseDuration(data.duration) : null;
    if (durationMs === null) errors.push('Enter how long it runs, like 30m, 12h or 3d.');
    else if (durationMs < L.MIN_DURATION_MS || durationMs > L.MAX_DURATION_MS) {
        errors.push(
            `A giveaway must run for between ${formatDuration(L.MIN_DURATION_MS)} and ${formatDuration(L.MAX_DURATION_MS)}.`
        );
    }

    let startsAt = now;
    let scheduled = false;
    if (typeof data.startsAt === 'string' && data.startsAt) {
        const when = new Date(data.startsAt);
        if (Number.isNaN(when.getTime())) errors.push('The start time is not a valid date.');
        else if (when.getTime() < now.getTime() - 60_000) errors.push('The start time is in the past.');
        else if (when.getTime() > now.getTime() + L.MAX_SCHEDULE_AHEAD_MS) {
            errors.push(`A giveaway can be scheduled at most ${formatDuration(L.MAX_SCHEDULE_AHEAD_MS)} ahead.`);
        } else if (when.getTime() > now.getTime() + 60_000) {
            startsAt = when;
            scheduled = true;
        }
    }

    const roleIds = Array.isArray(data.roleIds)
        ? [...new Set(data.roleIds.filter((id) => typeof id === 'string'))]
        : [];
    if (roleIds.length > L.ROLES_MAX) errors.push(`Choose at most ${L.ROLES_MAX} required roles.`);
    if (roleIds.some((id) => !context.roleIds.has(id))) errors.push('One of the required roles no longer exists.');

    const minLevel =
        data.minLevel === undefined || data.minLevel === null || data.minLevel === '' ? 0 : Number(data.minLevel);
    if (!Number.isInteger(minLevel) || minLevel < 0 || minLevel > L.LEVEL_MAX) {
        errors.push(`The minimum level must be between 0 and ${L.LEVEL_MAX}.`);
    }

    const voteBonus =
        data.voteBonus === undefined || data.voteBonus === null || data.voteBonus === '' ? 0 : Number(data.voteBonus);
    if (!Number.isInteger(voteBonus) || voteBonus < 0 || voteBonus > L.VOTE_BONUS_MAX) {
        errors.push(`Bonus entries for voting must be between 0 and ${L.VOTE_BONUS_MAX}.`);
    }

    if (errors.length > 0) return { giveaway: null, errors };
    return {
        giveaway: {
            prize,
            description: description || null,
            channelId,
            winnerCount,
            startsAt,
            endsAt: new Date(startsAt.getTime() + /** @type {number} */ (durationMs)),
            status: scheduled ? 'scheduled' : 'running',
            requirements: { roleIds, minLevel },
            voteBonus,
        },
        errors,
    };
}

/**
 * Checks the Giveaways page settings.
 * @param {unknown} input
 * @param {GiveawayContext} context
 */
export function validateGiveawaySettings(input, context) {
    const data = input && typeof input === 'object' ? /** @type {any} */ (input) : {};
    const errors = [];
    const managerRoleIds = Array.isArray(data.managerRoleIds)
        ? [...new Set(data.managerRoleIds.filter((id) => typeof id === 'string'))]
        : [];
    if (managerRoleIds.length > GIVEAWAY_LIMITS.MANAGER_ROLES_MAX) {
        errors.push(`Choose at most ${GIVEAWAY_LIMITS.MANAGER_ROLES_MAX} giveaway manager roles.`);
    }
    if (managerRoleIds.some((id) => !context.roleIds.has(id))) errors.push('One of the roles no longer exists.');
    return { settings: errors.length ? null : { managerRoleIds }, errors };
}
