import { MessageFlags, Events } from 'discord.js';
import User_Level_Cache from '../../levels/cache/userLevels.cache.js';
import { isHandledComponent } from '../../../shared/constants/componentIds.js';
import { reportError } from '../../../shared/utils/errorReport.js';
import Command_Settings_Cache from '../../commandSettings/cache/commandSettings.cache.js';
import { commandBlocker } from '../../commandSettings/utils/commandSettings.js';

export const name = Events.InteractionCreate;
export const once = false;
export const description = 'Registering Slash Commands / Autocomplete';

/**
 * @typedef {import('../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').BaseInteraction} interaction
 */

export async function execute(interaction) {
    const { guild, client } = interaction;

    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;
        try {
            await command.autocomplete(interaction, client);
        } catch (error) {
            client.utils.LogData(`Autocomplete Error: ${interaction.commandName}`, error.message, 'error');
            reportError(client, {
                source: `${commandLabel(interaction)} (autocomplete)`,
                error,
                guild,
                user: interaction.user,
            });
        }
        return;
    }

    // Buttons and forms that a feature handles itself (e.g. tickets, temp voice) are left to it
    if ((interaction.isMessageComponent() || interaction.isModalSubmit()) && isHandledComponent(interaction.customId)) {
        return;
    }
    if (interaction.isMessageComponent())
        return client.utils.Embed(
            interaction,
            'Red',
            client.utils.Translate('errors.title', interaction.locale),
            `This component is not functional yet.`,
            { flags: MessageFlags.Ephemeral }
        );
    if (interaction.isModalSubmit())
        return client.utils.Embed(
            interaction,
            'Red',
            client.utils.Translate('errors.title', interaction.locale),
            `This modal is not functional yet.`,
            { flags: MessageFlags.Ephemeral }
        );

    // Slash commands, and message/user menu commands (right-click → Apps)
    if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            const msg = client.utils.Translate('errors.no_command', interaction.locale);
            return client.utils.Embed(
                interaction,
                'Red',
                client.utils.Translate('errors.title', interaction.locale),
                msg,
                { flags: MessageFlags.Ephemeral }
            );
        }

        if (command.meta.developerOnly && !client.utils.DevPermissionCheck(interaction.user.id)) {
            const msg = client.utils.Translate('errors.developer_only', interaction.locale);
            return client.utils.Embed(
                interaction,
                'Red',
                client.utils.Translate('errors.title', interaction.locale),
                msg,
                { flags: MessageFlags.Ephemeral }
            );
        }

        // The server's Commands page: turned off, or only in some channels or for some roles
        if (interaction.inCachedGuild() && !command.meta.developerOnly) {
            const blocked = commandBlocker(interaction, await Command_Settings_Cache.get(interaction.guildId));
            if (blocked) {
                return interaction.reply({
                    content: client.utils.Translate(
                        `commands.settings.${blocked.key}`,
                        interaction.locale,
                        blocked.vars
                    ),
                    flags: MessageFlags.Ephemeral,
                    allowedMentions: { parse: [] },
                });
            }
        }

        if (!commandCooldown(interaction, command)) return;

        // Bot Permissions
        if (interaction.inCachedGuild() && command.meta.botPermissions.length > 0) {
            const [hasPerms, missingPerms] = client.utils.PermissionCheck(
                interaction,
                command.meta.botPermissions,
                guild.members.me
            );
            if (!hasPerms) {
                const msg = client.utils.Translate('errors.bot_missing_perms', interaction.locale, {
                    perms: missingPerms.flat().join(', '),
                });
                return client.utils.Embed(
                    interaction,
                    'Red',
                    client.utils.Translate('errors.title', interaction.locale),
                    msg,
                    { flags: MessageFlags.Ephemeral }
                );
            }
        }

        // User Permissions
        if (interaction.inCachedGuild() && command.meta.userPermissions.length > 0) {
            const [hasPerms, missingPerms] = client.utils.PermissionCheck(
                interaction,
                command.meta.userPermissions,
                interaction.member
            );
            if (!hasPerms) {
                const msg = client.utils.Translate('errors.user_missing_perms', interaction.locale, {
                    perms: missingPerms.flat().join(', '),
                });
                return client.utils.Embed(
                    interaction,
                    'Red',
                    client.utils.Translate('errors.title', interaction.locale),
                    msg,
                    { flags: MessageFlags.Ephemeral }
                );
            }
        }

        try {
            await command.execute(interaction, client);
        } catch (error) {
            client.utils.LogData(`Command Error: ${interaction.commandName}`, error.stack ?? error.message, 'error');
            // Also to the dev server's error channel (ERROR_CID), if set
            reportError(client, { source: commandLabel(interaction), error, guild, user: interaction.user });

            /** @type {import('discord.js').InteractionReplyOptions} */
            const errorReply = {
                content: `${client.customEmojis.reactions.Warning} An error occurred while executing this command.`,
                flags: MessageFlags.Ephemeral,
            };

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorReply);
                } else {
                    await interaction.reply(errorReply);
                }
            } catch (replyError) {
                client.utils.LogData(
                    'Command Error Reply',
                    `${interaction.commandName}: ${replyError.message}`,
                    'error'
                );
            }
            return;
        }

        if (guild) {
            await User_Level_Cache.incrementCommands(guild.id, interaction.user.id).catch((error) =>
                client.utils.LogData('Command Usage', `Failed to increment command count: ${error.message}`, 'error')
            );
        }
    }
}

/**
 * "/moderation ban": the command and subcommand, without option values. Menu commands are just their name.
 * @param {import('discord.js').CommandInteraction | import('discord.js').AutocompleteInteraction} interaction
 */
function commandLabel(interaction) {
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return `"${interaction.commandName}" menu`;
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand(false);
    return ['/' + interaction.commandName, group, subcommand].filter(Boolean).join(' ');
}

/**
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('../../../core/baseCommands.js').Command} command
 */
function commandCooldown(interaction, command) {
    const { commandName, user, client } = interaction;
    const expiresAt = client.cooldowns.getRemaining('command', user.id, commandName);

    if (expiresAt) {
        const msg = client.utils.Translate('errors.cooldown', interaction.locale, {
            command: commandName,
            time: client.utils.Timestamp(expiresAt),
        });
        client.utils.Embed(interaction, 'Red', client.utils.Translate('errors.title', interaction.locale), msg, {
            flags: [MessageFlags.Ephemeral],
        });
        return false;
    }

    client.cooldowns.add('command', user.id, command.meta.cooldown, commandName);
    return true;
}
