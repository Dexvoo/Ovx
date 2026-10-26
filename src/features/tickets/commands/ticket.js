import { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType, MessageFlags } from 'discord.js';

// For running tickets; ticket settings and the panel are on the dashboard
const handlers = {
    close: () => import('../subcommands/close.js'),
    add: () => import('../subcommands/add.js'),
    remove: () => import('../subcommands/remove.js'),
    lock: () => import('../subcommands/lock.js'),
    unlock: () => import('../subcommands/unlock.js'),
    claim: () => import('../subcommands/claim.js'),
    rename: () => import('../subcommands/rename.js'),
};

export const commandData = new SlashCommandBuilder();
commandData.setName('ticket');
commandData.setDescription('Private support tickets.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
// Visible to everyone: ticket owners can close their own tickets. Each subcommand checks permissions itself.
commandData.addSubcommand((s) =>
    s
        .setName('close')
        .setDescription('Close this ticket. A transcript is saved first.')
        .addStringOption((o) =>
            o.setName('reason').setDescription('Why it was closed (shown in the transcript)').setMaxLength(500)
        )
);
commandData.addSubcommand((s) =>
    s
        .setName('add')
        .setDescription('Let someone else see and talk in this ticket. (Staff)')
        .addUserOption((o) => o.setName('member').setDescription('Who to add').setRequired(true))
);
commandData.addSubcommand((s) =>
    s
        .setName('remove')
        .setDescription('Remove someone who was added to this ticket. (Staff)')
        .addUserOption((o) => o.setName('member').setDescription('Who to remove').setRequired(true))
);
commandData.addSubcommand((s) =>
    s.setName('lock').setDescription('Stop the owner sending messages (they can still read). (Staff)')
);
commandData.addSubcommand((s) => s.setName('unlock').setDescription('Let the owner send messages again. (Staff)'));
commandData.addSubcommand((s) =>
    s.setName('claim').setDescription('Take this ticket, or let it go if it is yours. (Staff)')
);
commandData.addSubcommand((s) =>
    s
        .setName('rename')
        .setDescription('Rename this ticket channel. (Staff)')
        .addStringOption((o) =>
            o.setName('name').setDescription('The new name').setMinLength(1).setMaxLength(90).setRequired(true)
        )
);
export const meta = {
    cooldown: 3,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
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
    const handlerModule = await handler();
    return handlerModule.execute(interaction);
}
