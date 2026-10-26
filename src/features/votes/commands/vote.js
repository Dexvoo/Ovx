import {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';
import { UserVote } from '../models/userVote.js';
import { votesEnabled, voteUrl, VOTE_WINDOW_MS } from '../utils/votes.js';
import { REMIND_BUTTON_ID } from '../utils/reminders.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('vote');
commandData.setDescription('Vote for Ovx on Top.gg, and see when you can vote again.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]);
commandData.setContexts([
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
]);

export const meta = {
    cooldown: 5,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * What /vote says about someone's votes: when they last voted, whether they can vote again, and their total.
 * @param {{ votes?: number, lastVotedAt?: Date | null } | null} record
 * @param {number} now
 * @returns {{ key: string, vars: Record<string, string | number> }[]}
 */
export function voteStatus(record, now = Date.now()) {
    const lastVoted = record?.lastVotedAt ? new Date(record.lastVotedAt).getTime() : null;
    const lines = [];
    if (lastVoted && now - lastVoted < VOTE_WINDOW_MS) {
        const next = Math.floor((lastVoted + VOTE_WINDOW_MS) / 1000);
        lines.push({ key: 'voted_recently', vars: { next: `<t:${next}:R>` } });
    } else {
        lines.push({ key: lastVoted ? 'can_vote_again' : 'can_vote', vars: {} });
    }
    if (record?.votes) lines.push({ key: 'total', vars: { count: record.votes } });
    return lines;
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
    const { client, locale } = interaction;
    const t = (key, vars) => client.utils.Translate(`commands.vote.${key}`, locale, vars);

    const lines = [t('intro'), '', t('rewards_title'), t('reward_xp'), t('reward_giveaways'), t('reward_time')];

    // Only known when Top.gg tells Ovx about votes (the dashboard's webhook)
    if (votesEnabled()) {
        const record = await UserVote.findOne({ userId: interaction.user.id })
            .lean()
            .catch(() => null);
        lines.push('', ...voteStatus(record).map((line) => t(line.key, line.vars)));
    }

    const embed = new EmbedBuilder()
        .setColor(await brandColour(interaction.inCachedGuild() ? interaction.guildId : null))
        .setTitle(t('title'))
        .setDescription(lines.join('\n'));
    const row = /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(t('button')).setEmoji('❤️').setURL(voteUrl())
    );
    // Reminders need to know when someone voted, which only the webhook tells Ovx
    if (votesEnabled()) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(REMIND_BUTTON_ID)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔔')
                .setLabel(t('remind_button'))
        );
    }
    return interaction.reply({ embeds: [embed], components: [row] });
}
