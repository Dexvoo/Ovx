/**
 * Main bot client initialization and file loading system.
 * Handles commands, events, and database models with recursive directory crawling.
 * @module bot
 */

// Core Dependencies
const { GatewayIntentBits, Collection } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs/promises');
require('dotenv').config();
const OvxClient = require('./structures/OvxClient');

const { DeveloperMode, PublicToken, DevToken } = process.env;

if (!PublicToken || !DevToken) {
  console.error('[ERROR] Missing required environment variables: PublicToken or DevToken.');
  process.exit(1);
}

const TOKEN = DeveloperMode === 'true' ? DevToken : PublicToken;

// --- Client Initialization ---
/**
 * Creates and configures the Discord bot client with necessary intents
 * @type {OvxClient}
 */
const client = new OvxClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

/**
 * Maps file handler types to their processing logic
 * @type {Object<string, Function>}
 */
const fileHandlers = {
  /**
   * Processes a command file
   * @param {Object} fileModule - The loaded command module
   * @param {string} filePath - The file path (for logging)
   */
  commands: (fileModule, filePath) => {
    if ('data' in fileModule && 'execute' in fileModule) {
      client.commands.set(fileModule.data.name, fileModule);
      client.utils.LogData(`${fileModule.data.name}`, fileModule.data.description, 'info');
    } else {
      client.utils.LogData(
        `Invalid Command: ${path.basename(filePath)}`,
        'Missing "data" or "execute" property.',
        'error'
      );
    }
  },

  /**
   * Processes an event file
   * @param {Object} fileModule - The loaded event module
   * @param {string} filePath - The file path (for logging)
   */
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
      client.utils.LogData(
        `Invalid Event: ${path.basename(filePath)}`,
        'Missing "name" or "execute" property.',
        'error'
      );
    }
  },

  /**
   * Processes a model file
   * @param {Object} fileModule - The loaded model module
   * @param {string} filePath - The file path (for logging)
   */
  models: (fileModule, filePath) => {
    const modelName = path.basename(filePath, '.js');
    client.utils.LogData('Model Loaded', modelName, 'info');
  },
};

/**
 * Recursively reads directories to find and load handler files.
 * Supports command files, event listeners, and database models.
 *
 * @async
 * @param {string} directory - The directory to crawl
 * @param {string} handlerType - The type of file to handle ('commands', 'events', 'models')
 * @throws {Error} If directory cannot be read or file loading fails
 * @returns {Promise<void>}
 */
async function loadDirectory(directory, handlerType) {
  const handler = fileHandlers[handlerType];
  if (!handler) {
    client.utils.Log(`[WARN] No handler found for type: ${handlerType}`);
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
      client.utils.Log(`Directory not found, skipping: ${directory}`);
    } else {
      console.error(`[FATAL] Could not read directory ${directory}:`, error);
    }
  }
}

/**
 * Initializes the bot by loading commands, models, and events
 *
 * @async
 * @returns {Promise<void>}
 */
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

/**
 * Main bootstrap function to start the bot
 * Initializes all handlers and logs into Discord
 *
 * @async
 * @returns {Promise<void>}
 */
(async () => {
  try {
    await initialise();
    await client.login(TOKEN);
  } catch (error) {
    console.error('[FATAL] An error occurred during bot startup:', error);
    process.exit(1);
  }
})();
