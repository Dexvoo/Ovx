import { GatewayIntentBits, Partials } from 'discord.js';
import loadCommands from '../core/baseCommands.js';
import loadEvents from '../core/baseEvents.js';
import refreshCommands from '../core/baseRefresh.js';
import Client from '../core/extendedClient.js';
import { ENV } from './environment.js';
import { checkVersion } from '../shared/utils/versionCheck.js';
import { Database_Connect } from './database.js';
import { Shutdown } from './shutdown.js';
import { reportError } from '../shared/utils/errorReport.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Only what features use; each intent adds gateway traffic. Slash commands (even in DMs) need none.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Member logs (privileged)
        GatewayIntentBits.GuildModeration, // Ban logs
        GatewayIntentBits.GuildExpressions, // Emoji and sticker logs (server logs)
        GatewayIntentBits.GuildVoiceStates, // Voice XP and voice logs
        GatewayIntentBits.GuildMessages, // Message XP and message logs
        GatewayIntentBits.MessageContent, // Message log content and XP length check (privileged)
        GatewayIntentBits.GuildMessageReactions, // Starboard
    ],
    // Without this, Discord's "member left" event is dropped for members the bot hasn't cached (most members of
    // larger servers), so leave logs and goodbye messages would be missed. Handlers must check member.partial.
    // Message, Reaction and User: reactions on messages from before Ovx started (starboard) arrive as partials,
    // and so do deletes and edits of uncached messages. Message handlers must check message.partial.
    partials: [Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.User],
});

// Registered before any startup work so failures during loading are caught too
process.on('SIGINT', () => Shutdown('SIGINT', client)); // CTRL+C in terminal
process.on('SIGTERM', () => Shutdown('SIGTERM', client)); // Docker/PM2 stop commands
process.on('message', (/** @type {any} */ message) => {
    if (message?.type === 'shutdown') Shutdown('MANAGER SHUTDOWN', client); // Sent by the ShardingManager
});
process.on('disconnect', () => Shutdown('MANAGER DISCONNECTED', client)); // Manager exited; don't run orphaned
process.on('unhandledRejection', (reason) => {
    client.utils.LogData('Unhandled Rejection', reason instanceof Error ? reason.stack : String(reason), 'error');
    reportError(client, { source: 'Unhandled promise rejection', error: reason });
});
process.on('uncaughtException', (error) => {
    // State is unknown after an uncaught exception; exit and let the ShardingManager respawn this shard.
    // The report gets a few seconds to reach the dev server first.
    client.utils.LogData('Uncaught Exception', error.stack ?? error.message, 'error');
    const report = reportError(client, { source: 'Crash (uncaught exception), shard restarting', error });
    Promise.race([report, new Promise((resolve) => setTimeout(resolve, 3000))]).finally(() => process.exit(1));
});

// Resolved from this file rather than process.cwd() so the bot can be started from any directory
const featuresPath = fileURLToPath(new URL('../features', import.meta.url));
const features = fs.readdirSync(featuresPath, { withFileTypes: true }).filter((entry) => entry.isDirectory());
client.utils.Log('Loading Commands/Events');
for (const feature of features) {
    const featurePath = path.join(featuresPath, feature.name);
    const commandsPath = path.join(featurePath, 'commands');
    const eventsPath = path.join(featurePath, 'events');

    // Features don't need both folders, e.g. an events-only feature
    if (fs.existsSync(commandsPath)) await loadCommands(client, commandsPath);
    if (fs.existsSync(eventsPath)) await loadEvents(client, eventsPath);
}

if (!client.shard || client.shard.ids[0] === 0) {
    client.utils.Log('Refreshing Commands');
    await refreshCommands(client);
} else {
    client.utils.LogData('Command Refresh', `Skipped on Shard ${client.shard.ids[0]} to prevent API spam.`, 'info');
}

try {
    await Database_Connect();
    await checkVersion(client.utils.LogData);

    await client.login(ENV.TOKEN);
} catch (error) {
    client.utils.LogData('Startup', `Failed to start: ${error.stack ?? error.message}`, 'error');
    process.exit(1);
}
