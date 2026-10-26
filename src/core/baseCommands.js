import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { registerHooks } from 'module';
import { PermissionsBitField } from 'discord.js';

/**
 * @typedef {import('./extendedClient.js').default} Client
 */

const RELOAD_PARAM = 'reload';

// Commands lazy-load their subcommands with relative imports, which resolve without the
// reloaded command's cache-busting query and so return the old cached module. This hook
// carries the query from a reloaded parent to files in `subcommands/` folders only;
// caches, models and utils must stay shared, so they are never re-imported.
registerHooks({
    resolve(specifier, context, nextResolve) {
        const result = nextResolve(specifier, context);
        if (!context.parentURL?.startsWith('file:') || !result.url.startsWith('file:')) return result;

        const version = new URL(context.parentURL).searchParams.get(RELOAD_PARAM);
        if (!version) return result;

        const url = new URL(result.url);
        if (!url.pathname.includes('/subcommands/')) return result;

        url.searchParams.set(RELOAD_PARAM, version);
        return { ...result, url: url.href };
    },
});

/**
 * Re-imports a command (and its subcommands) from disk and replaces it in client.commands.
 * Only affects the shard it runs on; use broadcastEval to reload every shard.
 * @param { Client } client
 * @param { string } commandName
 * @returns { Promise<string> } The reloaded command's name
 */
export async function reloadCommand(client, commandName) {
    const filePath = client.commands.get(commandName)?.filePath;
    if (!filePath) throw new Error(`No command file found for \`${commandName}\`.`);

    const imported = await import(`${filePath}?${RELOAD_PARAM}=${Date.now()}`);
    if (!imported.execute) throw new Error(`Missing execute function in ${filePath}`);

    const command = createCommand(imported, filePath);

    if (command.commandData.name !== commandName) client.commands.delete(commandName);
    client.commands.set(command.commandData.name, command);

    return command.commandData.name;
}

/**
 * @typedef {Object} CommandMeta
 * @property {number} cooldown - Seconds between uses per user
 * @property {boolean} developerOnly - Only usable by DEVELOPER_IDS; registered to the dev guild only
 * @property {bigint[]} botPermissions - Permissions the bot needs in the channel
 * @property {bigint[]} userPermissions - Permissions the user needs; also hides the command from users without them
 * @property {string[]} [privateOptions] - Options whose values are left out of the developer command log
 */

/**
 * @typedef {Object} Command
 * @property {import('discord.js').SlashCommandBuilder | import('discord.js').ContextMenuCommandBuilder} commandData - Slash or right-click menu command
 * @property {CommandMeta} meta
 * @property {(interaction: any, client: Client) => Promise<unknown>} execute - Gets the slash or menu interaction
 * @property {(interaction: import('discord.js').AutocompleteInteraction, client: Client) => Promise<unknown>} [autocomplete]
 * @property {string} filePath - file:// URL of the command module
 */

/** @type {CommandMeta} */
const DEFAULT_META = Object.freeze({
    cooldown: 5,
    developerOnly: false,
    botPermissions: [],
    userPermissions: [],
});

/**
 * Builds the object stored in client.commands from an imported command module.
 * Module namespaces are read-only, so this copies them and adds the defaults and file path.
 * @param {Record<string, any>} imported
 * @param {string} filePath
 * @returns {Command}
 */
function createCommand(imported, filePath) {
    const meta = { ...DEFAULT_META, ...imported.meta };

    // Hide the command from users who lack the permissions (the handler still enforces them,
    // since server admins can override command visibility)
    if (meta.userPermissions.length > 0 && imported.commandData.default_member_permissions === undefined) {
        imported.commandData.setDefaultMemberPermissions(PermissionsBitField.resolve(meta.userPermissions));
    }

    return /** @type {Command} */ ({ ...imported, meta, filePath });
}

/**
 * @param { Client } client
 * @param { string } dir
 * @returns { Promise<void> }
 */

export default async function loadCommands(client, dir) {
    const files = fs.readdirSync(dir, {
        withFileTypes: true,
    });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory()) {
            await loadCommands(client, fullPath);
            continue;
        }

        if (!file.name.endsWith('.js')) continue;

        if (!fullPath.includes(`${path.sep}commands${path.sep}`)) {
            continue;
        }

        try {
            const fileUrl = pathToFileURL(fullPath).href;
            const imported = await import(fileUrl);
            if (!imported.execute) {
                client.utils.LogData('Command Init Load Error', `Missing execute function at ${fullPath}`, 'error');
                continue;
            }

            const command = createCommand(imported, fileUrl);
            client.commands.set(command.commandData.name, command);
            client.utils.LogData(
                'Command',
                `${command.commandData.name} | ${'description' in command.commandData ? command.commandData.description : 'Right-click menu'}`,
                'success'
            );
        } catch (error) {
            client.utils.LogData('Command Init', `Error loading ${fullPath}: ${error.message}`, 'error');
        }
    }
}
