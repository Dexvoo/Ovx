import { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, MessageFlags } from 'discord.js';
import { Suggestion, CLOSED_STATUSES } from '../models/suggestion.js';
import { decide, canDecide, suggestionConfig, REASON_MAX } from '../utils/actions.js';

/** Subcommand → the status it sets */
const DECISIONS = { approve: 'approved', deny: 'denied', consider: 'considering', implement: 'implemented' };

export const commandData = new SlashCommandBuilder();
commandData.setName('suggestion');
commandData.setDescription('(Staff) Approve, deny or mark suggestions.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
// No default permissions: suggestion manager roles (set on the dashboard) can use it without Manage Server.
// The handler checks.
for (const [name, description] of [
    ['approve', 'Approve a suggestion.'],
    ['deny', 'Deny a suggestion.'],
    ['consider', 'Mark a suggestion as being considered.'],
    ['implement', 'Mark a suggestion as done.'],
]) {
    commandData.addSubcommand((sub) =>
        sub
            .setName(name)
            .setDescription(description)
            .addIntegerOption((option) =>
                option
                    .setName('number')
                    .setDescription('The suggestion number.')
                    .setRequired(true)
                    .setMinValue(1)
                    .setAutocomplete(true)
            )
            .addStringOption((option) =>
                option.setName('reason').setDescription('Why (shown on it).').setMaxLength(REASON_MAX)
            )
    );
}

export const meta = {
    cooldown: 3,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * Suggestions not decided yet, newest first, matching what's typed.
 * @param {import('discord.js').AutocompleteInteraction<'cached'>} interaction
 */
export async function autocomplete(interaction) {
    const typed = String(interaction.options.getFocused()).replace(/^#/, '').trim();
    const open = await Suggestion.find(
        { guildId: interaction.guildId, status: { $nin: CLOSED_STATUSES } },
        { number: 1, content: 1 }
    )
        .sort({ number: -1 })
        .limit(100)
        .lean();
    const choices = open
        .filter(
            (suggestion) =>
                !typed ||
                String(suggestion.number).startsWith(typed) ||
                suggestion.content.toLowerCase().includes(typed.toLowerCase())
        )
        .slice(0, 25)
        .map((suggestion) => ({
            name: `#${suggestion.number} · ${suggestion.content}`.slice(0, 100),
            value: suggestion.number,
        }));
    await interaction.respond(choices);
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { client, locale, options } = interaction;
    const t = (key, vars) => client.utils.Translate(`suggestions.${key}`, locale, vars);
    const reply = (content) =>
        interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    const config = await suggestionConfig(interaction.guildId);
    if (!canDecide(interaction.member, config)) return reply(t('errors.no_permission'));

    const status = DECISIONS[options.getSubcommand()];
    const result = await decide(interaction.guild, options.getInteger('number', true), status, {
        reason: options.getString('reason'),
        decidedBy: interaction.user.id,
    });
    if (!result.ok) return reply(t(`errors.${result.error}`));
    return reply(t('decided', { number: result.suggestion.number, status: t(`post.status_${status}`) }));
}
