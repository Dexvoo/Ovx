import { SlashCommandBuilder, MessageFlags, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { ENV } from '../../../bootstrap/environment.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('reload');
commandData.setDescription('(Developer) Reloads a command.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
commandData.addStringOption((o) =>
    o.setName('command').setDescription('The command to reload.').setAutocomplete(true).setRequired(true)
);
commandData.addBooleanOption((o) =>
    o.setName('global').setDescription('Set to true to be global, false is just developer guild').setRequired(true)
);

export const meta = {
    cooldown: 5,
    developerOnly: true,
    botPermissions: [],
    userPermissions: [],
};

/**
 * @param { import('discord.js').AutocompleteInteraction } interaction
 */
export async function autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();

    const choices = interaction.client.commands.map((command) => command.commandData.name);
    const filtered = choices.filter((c) => c.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);

    await interaction.respond(filtered.map((c) => ({ name: c, value: c })));
}

/**
 * @typedef {import('../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { options, client } = interaction;

    const commandName = options.getString('command');
    const global = options.getBoolean('global');

    if (!client.commands.has(commandName))
        return client.utils.Embed(
            interaction,
            'Red',
            client.utils.Translate('errors.title', interaction.locale),
            `There is no command with the name \`${commandName}\`.`,
            { flags: MessageFlags.Ephemeral }
        );

    // Reloading every shard can take a moment
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Each shard is its own process with its own client.commands, so reload all of them
        let newName;
        let shardCount = 1;
        if (client.shard) {
            const results = await client.shard.broadcastEval(
                (shardClient, { name }) => shardClient.reloadCommand(name),
                { context: { name: commandName } }
            );
            newName = results[0];
            shardCount = results.length;
        } else {
            newName = await client.reloadCommand(commandName);
        }

        // Register only this command with Discord (create overwrites a command with the same name).
        // Developer-only commands always stay in the dev guild, even if "global" was chosen.
        const newCommand = client.commands.get(newName);
        // Without a dev guild there is nowhere else to register, matching refreshCommands
        const registerGlobally = !ENV.DEV_GUILD_ID || (global && !newCommand.meta.developerOnly);
        await client.application.commands.create(
            newCommand.commandData,
            registerGlobally ? undefined : ENV.DEV_GUILD_ID
        );

        client.utils.Embed(
            interaction,
            'Green',
            `${client.customEmojis.reactions.Yes} Command Reloaded`,
            `\`${newCommand.commandData.name}\` reloaded on ${shardCount} shard(s) and registered ${registerGlobally ? 'globally' : 'to the developer guild'}.`
        );
    } catch (error) {
        client.utils.LogData('Reload', `${commandName}: ${error.stack ?? error.message}`, 'error');
        client.utils.Embed(
            interaction,
            'Red',
            client.utils.Translate('errors.title', interaction.locale),
            `There was an error while reloading command \`${commandName}\`:\n\`${error.message}\``
        );
    }
}
