import { EmbedBuilder, Colors } from 'discord.js';
import { DevEmbed } from './embed.js';
import { LogData } from './logger.js';

/** The same error from the same place is posted once in this window; repeats are counted instead. */
const REPEAT_WINDOW_MS = 10 * 60_000;
/** At most this many reports a minute per shard, so a broken feature can't flood the channel. */
const MAX_PER_MINUTE = 10;
const MAX_TRACKED = 500;

/** "source|message" → when it was last posted, and how many repeats were held back since */
const recent = new Map();
let minuteStartedAt = 0;
let sentThisMinute = 0;

/**
 * Whether an error should be posted now, and how many identical ones were held back since the last post.
 * Exported for tests.
 * @param {string} key
 * @param {number} [now]
 * @returns {{ send: boolean, heldBack: number }}
 */
export function shouldReport(key, now = Date.now()) {
    const seen = recent.get(key);
    if (seen && now - seen.at < REPEAT_WINDOW_MS) {
        seen.heldBack++;
        return { send: false, heldBack: seen.heldBack };
    }

    if (now - minuteStartedAt >= 60_000) {
        minuteStartedAt = now;
        sentThisMinute = 0;
    }
    if (sentThisMinute >= MAX_PER_MINUTE) return { send: false, heldBack: 0 };
    sentThisMinute++;

    if (recent.size >= MAX_TRACKED) recent.delete(recent.keys().next().value);
    recent.set(key, { at: now, heldBack: 0 });
    return { send: true, heldBack: seen?.heldBack ?? 0 };
}

/** For tests: forget everything seen so far. */
export function resetErrorReports() {
    recent.clear();
    minuteStartedAt = 0;
    sentThisMinute = 0;
}

/**
 * Posts an error to the dev server's error channel (ERROR_CID), so problems on the VPS are seen without
 * reading its console. Optional: without ERROR_CID nothing is posted. Never throws.
 *
 * @param {import('discord.js').Client} client
 * @param {{ source: string, error: unknown, guild?: import('discord.js').Guild | null,
 *   user?: import('discord.js').User | null, details?: string }} report
 *   source: where it happened, e.g. "/moderation ban" or "Event: guildMemberAdd"
 */
export async function reportError(client, { source, error, guild = null, user = null, details }) {
    try {
        const message = error instanceof Error ? error.message : String(error);
        const { send, heldBack } = shouldReport(`${source}|${message}`);
        if (!send) return;

        const stack = (error instanceof Error ? (error.stack ?? message) : message).slice(0, 1000);
        const embed = new EmbedBuilder()
            .setTitle(`Error | Shard #${client.shard?.ids[0] ?? 0}`)
            .setColor(Colors.Red)
            .addFields({ name: 'Where', value: source.slice(0, 1024) })
            .setDescription(`\`\`\`\n${stack.replace(/```/g, "'''")}\n\`\`\``)
            .setTimestamp();
        if (guild)
            embed.addFields({ name: 'Server', value: `${guild.name} (${guild.id})`.slice(0, 1024), inline: true });
        if (user) embed.addFields({ name: 'User', value: `@${user.username} (${user.id})`, inline: true });
        if (details) embed.addFields({ name: 'Details', value: details.slice(0, 1024) });
        if (heldBack > 0) {
            embed.setFooter({ text: `Also happened ${heldBack} more time(s) since it was last reported` });
        }

        await DevEmbed('error', /** @type {any} */ (client), embed);
    } catch (reportFailure) {
        // Reporting must never cause another error
        LogData('Error Report', `Could not report an error: ${reportFailure.message}`, 'warning');
    }
}
