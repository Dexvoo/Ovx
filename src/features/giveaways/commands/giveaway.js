import {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import { Giveaway } from '../models/giveaway.js';
import { validateGiveaway, GIVEAWAY_LIMITS } from '../utils/validation.js';
import {
    createGiveaway,
    endGiveaway,
    rerollGiveaway,
    cancelGiveaway,
    giveawayChannel,
    isGiveawayId,
} from '../utils/lifecycle.js';
import { canManageGiveaways } from '../utils/entry.js';
import { parseDuration, formatDuration } from '../../moderation/utils/checks.js';

const L = GIVEAWAY_LIMITS;
const DURATION_SUGGESTIONS = ['30m', '1h', '6h', '12h', '1d', '3d', '1w', '2w'];

export const commandData = new SlashCommandBuilder();
commandData.setName('giveaway');
commandData.setDescription('Run giveaways in this server.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
// No default permissions: /giveaway list is for everyone, and giveaway manager roles (set on the dashboard)
// can run giveaways without Manage Server. The other subcommands check this themselves.

commandData.addSubcommand((sub) =>
    sub
        .setName('start')
        .setDescription('Start a giveaway.')
        .addStringOption((option) =>
            option.setName('prize').setDescription('What can be won.').setRequired(true).setMaxLength(L.PRIZE_MAX)
        )
        .addStringOption((option) =>
            option
                .setName('duration')
                .setDescription('How long it runs, like 30m, 12h or 3d.')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
            option
                .setName('winners')
                .setDescription('How many winners (default 1).')
                .setMinValue(1)
                .setMaxValue(L.WINNERS_MAX)
        )
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Where to post it (default: this channel).')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addRoleOption((option) =>
            option.setName('required_role').setDescription('Only members with this role can enter.')
        )
        .addIntegerOption((option) =>
            option
                .setName('min_level')
                .setDescription('Only members at this Ovx level or higher can enter.')
                .setMinValue(1)
                .setMaxValue(L.LEVEL_MAX)
        )
        .addIntegerOption((option) =>
            option
                .setName('vote_bonus')
                .setDescription('Extra entries for members who voted for Ovx on Top.gg.')
                .setMinValue(1)
                .setMaxValue(L.VOTE_BONUS_MAX)
        )
        .addUserOption((option) => option.setName('host').setDescription('Who is hosting it (default: you).'))
        .addStringOption((option) =>
            option.setName('description').setDescription('More about the prize.').setMaxLength(L.DESCRIPTION_MAX)
        )
);
commandData.addSubcommand((sub) =>
    sub
        .setName('end')
        .setDescription('End a giveaway now and draw the winners.')
        .addStringOption((option) =>
            option.setName('giveaway').setDescription('The giveaway.').setRequired(true).setAutocomplete(true)
        )
);
commandData.addSubcommand((sub) =>
    sub
        .setName('reroll')
        .setDescription('Draw new winners for an ended giveaway.')
        .addStringOption((option) =>
            option.setName('giveaway').setDescription('The giveaway.').setRequired(true).setAutocomplete(true)
        )
        .addIntegerOption((option) =>
            option
                .setName('winners')
                .setDescription('How many new winners (default 1).')
                .setMinValue(1)
                .setMaxValue(L.WINNERS_MAX)
        )
);
commandData.addSubcommand((sub) =>
    sub
        .setName('cancel')
        .setDescription('Cancel a giveaway without drawing winners.')
        .addStringOption((option) =>
            option.setName('giveaway').setDescription('The giveaway.').setRequired(true).setAutocomplete(true)
        )
);
commandData.addSubcommand((sub) => sub.setName('list').setDescription('See the giveaways running in this server.'));

export const meta = {
    cooldown: 3,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/** Which giveaways each subcommand can pick from. */
const PICKABLE = { end: ['running'], reroll: ['ended'], cancel: ['scheduled', 'running'] };

/**
 * @param {import('discord.js').AutocompleteInteraction<'cached'>} interaction
 */
export async function autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const typed = String(focused.value).trim().toLowerCase();

    if (focused.name === 'duration') {
        const choices = [];
        const parsed = typed ? parseDuration(typed) : null;
        if (parsed !== null && parsed >= L.MIN_DURATION_MS && parsed <= L.MAX_DURATION_MS) {
            choices.push({ name: formatDuration(parsed), value: typed.slice(0, 100) });
        }
        for (const value of DURATION_SUGGESTIONS) {
            const name = formatDuration(/** @type {number} */ (parseDuration(value)));
            if (choices.some((choice) => choice.name === name)) continue;
            if (!typed || name.includes(typed) || value.startsWith(typed)) choices.push({ name, value });
        }
        return interaction.respond(choices.slice(0, 25));
    }

    const statuses = PICKABLE[interaction.options.getSubcommand()];
    if (!statuses) return interaction.respond([]);
    const giveaways = await Giveaway.find({ guildId: interaction.guildId, status: { $in: statuses } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    const t = (key, vars) => interaction.client.utils.Translate(`giveaways.command.${key}`, interaction.locale, vars);
    const choices = giveaways
        .filter((giveaway) => !typed || giveaway.prize.toLowerCase().includes(typed))
        .slice(0, 25)
        .map((giveaway) => ({
            name: `${giveaway.prize.slice(0, 70)} · ${t(`choice_${giveaway.status}`)}`.slice(0, 100),
            value: String(giveaway._id),
        }));
    return interaction.respond(choices);
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { client, options, locale } = interaction;
    const t = (key, vars) => client.utils.Translate(`giveaways.command.${key}`, locale, vars);
    const reply = (colour, title, description) =>
        client.utils.Embed(interaction, colour, title, description, { flags: MessageFlags.Ephemeral });
    const error = (key, vars) => reply('Red', client.utils.Translate('errors.title', locale), t(key, vars));

    const subcommand = options.getSubcommand();
    if (subcommand === 'list') return list(interaction, t);

    if (!(await canManageGiveaways(interaction.member))) return error('no_permission');

    if (subcommand === 'start') {
        const channel = options.getChannel('channel') ?? interaction.channel;
        const role = options.getRole('required_role');
        const { giveaway: valid, errors } = validateGiveaway(
            {
                prize: options.getString('prize', true),
                description: options.getString('description'),
                channelId: channel?.id,
                winnerCount: options.getInteger('winners') ?? 1,
                duration: options.getString('duration', true),
                roleIds: role ? [role.id] : [],
                minLevel: options.getInteger('min_level') ?? 0,
                voteBonus: options.getInteger('vote_bonus') ?? 0,
            },
            {
                textChannelIds: new Set(channel && giveawayChannel(interaction.guild, channel.id) ? [channel.id] : []),
                roleIds: new Set(interaction.guild.roles.cache.filter((r) => r.id !== interaction.guildId).keys()),
            }
        );
        if (!valid) return reply('Red', client.utils.Translate('errors.title', locale), errors.join('\n'));

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await createGiveaway(interaction.guild, valid, {
            hostId: options.getUser('host')?.id ?? interaction.user.id,
            createdBy: interaction.user.id,
        });
        if (!result.ok) return error(result.reason, { max: L.ACTIVE_MAX });
        return reply(
            'Green',
            t('started_title'),
            t('started', { prize: valid.prize, channel: `<#${valid.channelId}>` })
        );
    }

    const giveawayId = options.getString('giveaway', true);
    if (!isGiveawayId(giveawayId)) return error('not_found');

    if (subcommand === 'end') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await endGiveaway(interaction.guild, giveawayId);
        if (!result.ok) return error(result.reason);
        return reply(
            'Green',
            t('ended_title'),
            t('ended', { prize: result.giveaway.prize, count: result.winners.length })
        );
    }
    if (subcommand === 'reroll') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await rerollGiveaway(interaction.guild, giveawayId, options.getInteger('winners') ?? 1);
        if (!result.ok) return error(result.reason);
        return reply(
            'Green',
            t('rerolled_title'),
            t('rerolled', { winners: result.winners.map((id) => `<@${id}>`).join(', ') })
        );
    }
    if (subcommand === 'cancel') {
        const result = await cancelGiveaway(interaction.guild, giveawayId);
        if (!result.ok) return error(result.reason);
        return reply('Green', t('cancelled_title'), t('cancelled', { prize: result.giveaway.prize }));
    }
}

/**
 * The running and upcoming giveaways, with links. Anyone can use this.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 * @param {(key: string, vars?: object) => string} t
 */
async function list(interaction, t) {
    const giveaways = await Giveaway.find({ guildId: interaction.guildId, status: { $in: ['running', 'scheduled'] } })
        .sort({ endsAt: 1 })
        .limit(L.ACTIVE_MAX)
        .lean();
    const unix = (date) => Math.floor(new Date(date).getTime() / 1000);
    const lines = giveaways.map((giveaway) => {
        const name = giveaway.messageId
            ? `[${giveaway.prize}](https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId})`
            : `**${giveaway.prize}**`;
        return giveaway.status === 'running'
            ? t('list_running', { name, relative: `<t:${unix(giveaway.endsAt)}:R>`, count: giveaway.entrantCount })
            : t('list_scheduled', { name, relative: `<t:${unix(giveaway.startsAt)}:R>` });
    });
    return interaction.client.utils.Embed(
        interaction,
        'Brand',
        t('list_title'),
        lines.length > 0 ? lines.join('\n') : t('list_empty'),
        { flags: MessageFlags.Ephemeral }
    );
}
