import { MessageFlags, time, TimestampStyles } from 'discord.js';
import { memberHistory } from '../utils/cases.js';
import { formatDuration } from '../utils/checks.js';
import { hasPermissions, t } from '../utils/common.js';

const SHOWN_CASES = 10;
const REASON_PREVIEW = 120;

/**
 * A member's record: totals and their latest cases. Works for people who have left or are banned too.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    if (!(await hasPermissions(interaction, 'history'))) return;
    const user = interaction.options.getUser('user', true);

    const { cases, counts } = await memberHistory(interaction.guildId, user.id, SHOWN_CASES);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    const lines = [];
    if (total === 0) lines.push(t(interaction, 'history_empty', { user: user.toString() }));
    else {
        const { warn, mute, kick, ban, note } = counts;
        lines.push(t(interaction, 'history_totals', { warn, mute, kick, ban, note }), '');
        lines.push(...cases.map((entry) => caseLine(interaction, entry)));
        if (total > SHOWN_CASES) lines.push(`-# ${t(interaction, 'history_more', { count: total - SHOWN_CASES })}`);
    }
    const description = lines.join('\n');

    return interaction.client.utils.Embed(
        interaction,
        'Brand',
        t(interaction, 'history_title', { user: user.username }),
        description,
        { flags: MessageFlags.Ephemeral, thumbnail: user.displayAvatarURL() }
    );
}

/**
 * "**#12** Mute (1 hour) · 3 days ago · by @dexvo" with the reason underneath.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 * @param {ReturnType<typeof import('../utils/cases.js').caseView>} entry
 */
function caseLine(interaction, entry) {
    const action = t(interaction, `action_${entry.action}`);
    const length = entry.durationMs ? ` (${formatDuration(entry.durationMs)})` : '';
    const by = entry.moderatorName ? ` · ${t(interaction, 'history_by', { moderator: entry.moderatorName })}` : '';
    const when = time(new Date(entry.createdAt), TimestampStyles.RelativeTime);
    const reason = entry.reason
        ? entry.reason.length > REASON_PREVIEW
            ? `${entry.reason.slice(0, REASON_PREVIEW - 1)}…`
            : entry.reason
        : t(interaction, 'no_reason');
    return `**#${entry.number}** ${action}${length} · ${when}${by}\n> ${reason.replace(/\n/g, ' ')}`;
}
