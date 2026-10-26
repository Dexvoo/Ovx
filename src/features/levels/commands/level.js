import { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType, MessageFlags } from 'discord.js';
import Guild_Level_Cache from '../cache/guildLevels.cache.js';

// Level settings are changed on the dashboard; these are for members
const handlers = {
    rank: () => import('../subcommands/rank.js'),
    leaderboard: () => import('../subcommands/leaderboard.js'),
};

export const commandData = new SlashCommandBuilder();
commandData.setName('level');
commandData.setDescription('Check ranks and the server leaderboard.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
commandData.addSubcommand((s) =>
    s
        .setName('rank')
        .setDescription("Shows your or another user's current level and XP.")
        .addUserOption((o) => o.setName('user').setDescription('The user you want to check.').setRequired(false))
);
commandData.addSubcommand((s) =>
    s
        .setName('leaderboard')
        .setDescription('Displays the server leaderboard.')
        .addStringOption((o) =>
            o
                .setName('type')
                .setDescription('The type of leaderboard to show.')
                .setRequired(true)
                .addChoices(
                    { name: 'Levels', value: 'level' },
                    { name: 'Messages', value: 'totalMessages' },
                    { name: 'Voice', value: 'totalVoice' },
                    { name: 'Commands', value: 'totalCommands' }
                )
        )
);

export const meta = {
    cooldown: 5,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * @typedef {import('../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();
    const handler = handlers[subcommand];
    if (!handler)
        return interaction.client.utils.Embed(
            interaction,
            'Red',
            interaction.client.utils.Translate('errors.title', interaction.locale),
            interaction.client.utils.Translate('errors.no_subcommand', interaction.locale, { subcommand }),
            { flags: MessageFlags.Ephemeral }
        );

    // Errors propagate to the slash command handler, which logs them and replies to the user
    const guildConfig = await Guild_Level_Cache.get(interaction.guildId);
    const handlerModule = await handler();
    return handlerModule.execute(interaction, guildConfig);
}
