import {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord.js';
import { overviewPage, commandPage, commandIds, featureOf } from '../utils/help.js';
import Command_Settings_Cache from '../../commandSettings/cache/commandSettings.cache.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('help');
commandData.setDescription('Get started with Ovx: what it does, and every command.');
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]);
commandData.setContexts([
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
]);
commandData.addStringOption((option) =>
    option.setName('command').setDescription('Details about one command.').setAutocomplete(true)
);

export const meta = {
    cooldown: 3,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
};

/**
 * The help context for an interaction: its language, server, where it was used, and command IDs for mentions.
 * @param {import('discord.js').BaseInteraction} interaction
 */
export async function helpContext(interaction) {
    return {
        locale: interaction.locale,
        // Only servers Ovx is in have their own colour and settings
        guildId: interaction.inCachedGuild() ? interaction.guildId : null,
        context: interaction.context ?? null,
        ids: await commandIds(interaction.client),
        // Commands this server turned off on its Commands page are left out
        disabled: interaction.inCachedGuild()
            ? new Set((await Command_Settings_Cache.get(interaction.guildId)).disabled)
            : new Set(),
    };
}

/** Slash commands people can look up: not developer tools, and not right-click menus (their category page explains those). */
const publicCommands = (client) =>
    [...client.commands.values()].filter(
        (command) =>
            !command.meta.developerOnly && featureOf(command) !== 'developer' && 'description' in command.commandData
    );

/**
 * @param {import('discord.js').AutocompleteInteraction} interaction
 */
export async function autocomplete(interaction) {
    const typed = String(interaction.options.getFocused()).trim().toLowerCase().replace(/^\//, '');
    const choices = publicCommands(interaction.client)
        .map((command) => command.commandData.name)
        .filter((name) => !typed || name.toLowerCase().includes(typed))
        .sort()
        .slice(0, 25)
        .map((name) => ({ name: `/${name}`, value: name }));
    await interaction.respond(choices);
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
    const { client, locale } = interaction;
    const help = await helpContext(interaction);
    const wanted = interaction.options.getString('command');

    if (wanted) {
        const name = wanted.trim().replace(/^\//, '').split(' ')[0];
        const command = publicCommands(client).find(
            (item) => item.commandData.name.toLowerCase() === name.toLowerCase()
        );
        if (!command) {
            return interaction.reply({
                content: client.utils.Translate('commands.help.unknown_command', locale, { name }),
                flags: MessageFlags.Ephemeral,
            });
        }
        return interaction.reply({ ...(await commandPage(command, help)), flags: MessageFlags.Ephemeral });
    }

    const canManage = Boolean(
        interaction.inCachedGuild() && interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    );
    return interaction.reply({ ...(await overviewPage(client, help, { canManage })), flags: MessageFlags.Ephemeral });
}
