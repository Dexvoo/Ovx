// Core Dependencies
const { GatewayIntentBits, Collection } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs/promises');
require('dotenv').config();
const OvxClient = require('./structures/OvxClient');
const { DeveloperMode, PublicToken, DevToken } = process.env;
if (!PublicToken || !DevToken) {
    console.error('[ERROR] Missing required environment variables: PublicToken or DevToken.');
    process.exit(1); // Exit with an error code
}
const TOKEN = DeveloperMode === 'true' ? DevToken : PublicToken;

// --- Client Initialization ---
const client = new OvxClient({
    intents: [
        GatewayIntentBits.Guilds, // Guild create/update/delete events (roles, channels, threads)
		GatewayIntentBits.GuildMembers, // Member add/update/remove events
		GatewayIntentBits.GuildModeration, // Ban add/remove and Guild audit log events
		GatewayIntentBits.GuildExpressions, // Emoji and sticker create/update/delete events
		// GatewayIntentBits.GuildIntegrations, // Integration create/update/delete events
		// GatewayIntentBits.GuildWebhooks, // Webhook create/update/delete events
		GatewayIntentBits.GuildInvites, // Invite create/update/delete events
		GatewayIntentBits.GuildVoiceStates, // Voice state create/update/delete events
		// GatewayIntentBits.GuildPresences, // Presence update events
		GatewayIntentBits.GuildMessages, // Message create/update/delete events
		// GatewayIntentBits.GuildMessageReactions, // Reaction add/remove events
		// GatewayIntentBits.GuildMessageTyping, // Typing start events
		GatewayIntentBits.DirectMessages, // DM create/update/delete events
		// GatewayIntentBits.DirectMessageReactions, // Reaction add/remove events
		// GatewayIntentBits.DirectMessageTyping, // Typing start events
		GatewayIntentBits.MessageContent, // Message content in DMs and guilds
		// GatewayIntentBits.GuildScheduledEvents, // Scheduled event create/update/delete events
		// GatewayIntentBits.AutoModerationConfiguration, // Auto-moderation config update events
		// GatewayIntentBits.AutoModerationExecution, // Auto-moderation execution events
    ],
});

client.commands = new Collection();

const fileHandlers = {
    commands: (fileModule, filePath) => {
        if ('data' in fileModule && 'execute' in fileModule) {
            client.commands.set(fileModule.data.name, fileModule);
            client.utils.LogData(`${fileModule.data.name}`, fileModule.data.description, 'info');
        } else {
            client.utils.LogData(`Invalid Command: ${path.basename(filePath)}`, 'Missing "data" or "execute" property.', 'error');
        }
    },
    events: (fileModule, filePath) => {
        if ('name' in fileModule && 'execute' in fileModule) {
            const eventName = fileModule.name;
            const listener = (...args) => fileModule.execute(...args);
            
            if (fileModule.once) {
                client.once(eventName, listener);
            } else {
                client.on(eventName, listener);
            }
            client.utils.LogData(`${eventName}`, fileModule.nickname || 'No nickname provided.', 'info');
        } else {
            client.utils.LogData(`Invalid Event: ${path.basename(filePath)}`, 'Missing "name" or "execute" property.', 'error');
        }
    },
    models: (fileModule, filePath) => {
        // Mongoose models typically register themselves on require().
        // This simplified handler just logs the successful loading.
        const modelName = path.basename(filePath, '.js');
        client.utils.LogData('Model Loaded', modelName, 'info');
    },
};

/**
 * Recursively reads directories to find and load handler files.
 * @param {string} directory - The directory to crawl.
 * @param {string} handlerType - The type of file to handle ('commands', 'events', etc.).
 */
async function loadDirectory(directory, handlerType) {
    const handler = fileHandlers[handlerType];
    if (!handler) {
        client.utils.Log(`[WARN] No handler found for type: ${handlerType}`, '','warn');
        return;
    }
    
    try {
        const filesAndFolders = await fs.readdir(directory, { withFileTypes: true });

        for (const item of filesAndFolders) {
            const fullPath = path.join(directory, item.name);
            if (item.isDirectory()) {
                await loadDirectory(fullPath, handlerType);
            } else if (item.isFile() && item.name.endsWith('.js')) {
                try {
                    const fileModule = require(fullPath);
                    handler(fileModule, fullPath);
                } catch (error) {
                    console.error(`[ERROR] Failed to load file ${fullPath}:`, error);
                }
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            client.utils.Log(`Directory not found, skipping: ${directory}`, '', 'warn');
        } else {
            console.error(`[FATAL] Could not read directory ${directory}:`, error);
        }
    }
}

const initialise = async () => {
    client.utils.Log('--- Initialising Bot ---');
    
    const directoriesToLoad = ['commands', 'models', 'events'];

    for (const dirType of directoriesToLoad) {
        client.utils.Log(`Loading ${dirType}...`);
        const dirPath = path.join(__dirname, dirType);
        await loadDirectory(dirPath, dirType);
    }
    
    client.utils.Log('--- Initialisation Complete ---');
};


(async () => {
    try {
        await initialise();
        await client.login(TOKEN);
    } catch (error) {
        console.error('[FATAL] An error occurred during bot startup:', error);
        process.exit(1);
    }
})();