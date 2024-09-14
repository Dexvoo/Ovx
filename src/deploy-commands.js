const { PublicToken, DevToken, PublicClientID, DevClientID, DeveloperMode, DevGuildID } = process.env;
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fsPromises = require('fs').promises;
const path = require('node:path');
const { cleanConsoleLogData, cleanConsoleLog } = require('./utils/ConsoleLogs');

// Helper function to choose the correct ClientID and Token
const getClientDetails = () => ({
  ClientID: DeveloperMode === 'true' ? DevClientID : PublicClientID,
  Token: DeveloperMode === 'true' ? DevToken : PublicToken,
});

const { ClientID, Token } = getClientDetails();
const rest = new REST({ version: '10' }).setToken(Token);

const init = async () => {
  try {
    cleanConsoleLog('Starting Command Refresh');

    // Get and register global and guild commands concurrently
    const commandsDirectory = path.join(__dirname, 'commands');
    
    const [commandFiles, devCommandFiles] = await Promise.all([
      collectCommands(commandsDirectory, 'commands'),
      collectCommands(commandsDirectory, 'devcommands'),
    ]);

    console.log(`Public: ${commandFiles.length}`);
    console.log(`Dev: ${devCommandFiles.length}`);

    await Promise.all([
      refreshCommands(Routes.applicationCommands(ClientID), commandFiles),
      refreshCommands(Routes.applicationGuildCommands(ClientID, DevGuildID), devCommandFiles)
    ]);

    cleanConsoleLog('Finished Command Refresh');
  } catch (error) {
    console.error('Error during command refresh:', error);
  }
};

// Helper function to collect command files
async function collectCommands(directory, type) {
  let commandFiles = [];
  await crawlCommands(directory, commandFiles, type);
  return commandFiles;
}

// Function to crawl through directories and collect commands
async function crawlCommands(directory, filesArray, type) {
  const dirs = await fsPromises.readdir(directory, { withFileTypes: true });

  for (const dir of dirs) {
    const newPath = path.join(directory, dir.name);
    
    if (dir.isDirectory()) {
      await crawlCommands(newPath, filesArray, type);
    } else if (dir.name.endsWith('.js')) {
      const command = await require(newPath);

      if (isValidCommand(command, type, newPath)) {
        cleanConsoleLogData(command.data.name, command.data.description, 'info');
        filesArray.push(command.data.toJSON());
      } else {
        cleanConsoleLogData(dir.name, 'Invalid command structure', 'error');
      }
    }
  }
}

// Helper function to check if the command is valid and matches the type
function isValidCommand(command, type, filePath) {
  const isDevCommand = filePath.includes('Developer');
  return (
    'data' in command && 
    'execute' in command && 
    ((type === 'commands' && !isDevCommand) || (type === 'devcommands' && isDevCommand))
  );
}

// Helper function to refresh commands (either global or guild)
async function refreshCommands(route, commands) {
  try {
    // Delete existing commands
    await rest.put(route, { body: [] });
    cleanConsoleLogData('Commands', 'Deleted existing commands', 'success');

    // Register new commands
    await rest.put(route, { body: commands });
    cleanConsoleLogData('Commands', 'Registered new commands', 'success');
  } catch (error) {
    console.error(`Error updating commands for route ${route}:`, error);
  }
}

init();