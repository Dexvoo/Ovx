import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { UserVote } from '../models/userVote.js';
import { VOTE_WINDOW_MS, voteUrl } from './votes.js';
import { Translate } from '../../../shared/utils/i18n.js';
import { ENV } from '../../../bootstrap/environment.js';
import { LogData } from '../../../shared/utils/logger.js';

/** The "Remind me" button on /vote and in reminders: turns reminders on or off for whoever clicks it. */
export const REMIND_BUTTON_ID = 'vote:remind';
/** Most reminders sent per check, to stay well inside Discord's limits. */
const BATCH = 50;
const BRAND = '#b69cff';

/**
 * Turns someone's vote reminders on or off.
 * @param {string} userId
 * @returns {Promise<boolean>} Whether reminders are now on
 */
export async function toggleReminders(userId, now = new Date()) {
    const current = await UserVote.findOne({ userId }, { remind: 1, lastVotedAt: 1 }).lean();
    const remind = !current?.remind;
    // Turned on within 12 hours of a vote: they're reminded when it's up. Turned on after that: they can
    // already vote (which /vote just told them), so the old vote doesn't trigger a reminder straight away.
    const lastVoted = current?.lastVotedAt ? new Date(current.lastVotedAt).getTime() : null;
    const windowPassed = lastVoted !== null && now.getTime() - lastVoted >= VOTE_WINDOW_MS;
    await UserVote.updateOne(
        { userId },
        { $set: { remind, ...(remind && { remindedAt: windowPassed ? now : null }) } },
        { upsert: true }
    );
    return remind;
}

/**
 * The reminder DM: a vote button, and a button to stop reminders.
 * @param {string} locale
 * @returns {import('discord.js').MessageCreateOptions}
 */
export function reminderMessage(locale = ENV.DEFAULT_LANGUAGE) {
    const t = (key) => Translate(`commands.vote.${key}`, locale);
    const embed = new EmbedBuilder().setColor(BRAND).setTitle(t('reminder_title')).setDescription(t('reminder'));
    const row = /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(t('button')).setEmoji('❤️').setURL(voteUrl()),
        new ButtonBuilder().setCustomId(REMIND_BUTTON_ID).setStyle(ButtonStyle.Secondary).setLabel(t('stop_button'))
    );
    return { embeds: [embed], components: [row] };
}

/**
 * DMs everyone whose 12 hours since voting are up and who hasn't been reminded about that vote yet.
 * Each person is marked before the DM, so a crash or a second check never reminds them twice.
 * @param {import('discord.js').Client} client
 * @param {Date} [now]
 * @returns {Promise<number>} How many reminders were sent
 */
export async function sendDueReminders(client, now = new Date()) {
    const due = await UserVote.find(
        {
            remind: true,
            lastVotedAt: { $ne: null, $lte: new Date(now.getTime() - VOTE_WINDOW_MS) },
            $or: [{ remindedAt: null }, { $expr: { $lt: ['$remindedAt', '$lastVotedAt'] } }],
        },
        { userId: 1, lastVotedAt: 1 }
    )
        .limit(BATCH)
        .lean();

    let sent = 0;
    for (const { userId, lastVotedAt } of due) {
        // Claimed first: only one check can send this reminder
        const claimed = await UserVote.updateOne(
            { userId, lastVotedAt, $or: [{ remindedAt: null }, { remindedAt: { $lt: lastVotedAt } }] },
            { $set: { remindedAt: now } }
        );
        if (!claimed.modifiedCount) continue;

        const user = await client.users.fetch(userId).catch(() => null);
        try {
            if (!user) throw new Error('unknown user');
            await user.send(reminderMessage());
            sent++;
        } catch (error) {
            // DMs closed, or no shared server: stop trying, they can turn it back on with /vote
            await UserVote.updateOne({ userId }, { $set: { remind: false } });
            LogData('Vote Reminders', `Could not DM ${userId}, reminders turned off: ${error.message}`, 'debug');
        }
    }
    return sent;
}
