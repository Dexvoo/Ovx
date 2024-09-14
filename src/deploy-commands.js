require('dotenv').config();
const { PublicToken, DevToken, PublicClientID, DevClientID, DeveloperMode, DevGuildID } = process.env;
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fsPromises = require('fs').promises;
const path = require('node:path');
const { cleanConsoleLogData, cleanConsoleLog } = require('./utils/ConsoleLogs');


let ClientID = DeveloperMode === 'true' ? DevClientID : PublicClientID;
let Token = DeveloperMode === 'true' ? DevToken : PublicToken;

const rest = new REST({ version: '10' }).setToken(Token);

const init = async () => {
	cleanConsoleLog('Starting Command Refresh');

	let commandFiles = [];
	let commandsDirectory = path.join(__dirname, 'commands');
	await commandsCrawl(commandsDirectory, commandFiles, 'commands');
	
	console.log(`Public: ${commandFiles.length}`);
	// delete global commands
	rest.put(Routes.applicationCommands(ClientID), { body: [] })
	.then(() =>
		cleanConsoleLogData('Commands', 'Deleted application commands', 'success')
	).catch(console.error);

	// register global commands
	rest.put(Routes.applicationCommands(ClientID), { body: commandFiles })
	.then(( ) => {
		cleanConsoleLogData('Commands', 'Registered application commands', 'success');
		cleanConsoleLog('Finished Command Refresh');
	}).catch(console.error);





	let devCommandFiles = [];
	await commandsCrawl(commandsDirectory, devCommandFiles, 'devcommands');

	console.log(`Dev: ${devCommandFiles.length}`);
	// delete guild commands
	rest.put(Routes.applicationGuildCommands(ClientID, DevGuildID), { body: [] }).then(() =>
		cleanConsoleLogData('Commands', 'Deleted guild commands', 'success')
	).catch(console.error);

	// register guild commands
	rest.put(Routes.applicationGuildCommands(ClientID, DevGuildID), { body: devCommandFiles }).then(() => {
		cleanConsoleLogData('Commands', 'Registered guild commands', 'success');
	}).catch(console.error);
};
init();



















async function commandsCrawl(directory, filesArray, type) {
	const dirs = await fsPromises.readdir(directory, {
		withFileTypes: true,
	});

	//loop through all files/directories
	for (let i = 0; i < dirs.length; i++) {
		let currentDir = dirs[i];
		let newPath = path.join(directory, currentDir.name);

		if (currentDir.isDirectory()) {
			//if directory commandsCrawl again.
			await commandsCrawl(newPath, filesArray, type);
		} else {

			if(type === 'commands') {
				if (!newPath.includes('Developer')) {
					if (currentDir.name.endsWith('.js')) {
						const command = await require(newPath);
					
						if ('data' in command && 'execute' in command) {
							cleanConsoleLogData(command.data.name, command.data.description, 'info');
							filesArray.push(command.data.toJSON());
						} else {
							cleanConsoleLogData(currentDir.name, ' ', 'error');
						}
					}
				}
			}
			if(type === 'devcommands') {
				if (newPath.includes('Developer')) {
					if (currentDir.name.endsWith('.js')) {
						const command = await require(newPath);
		
						if ('data' in command && 'execute' in command) {
							cleanConsoleLogData(command.data.name, command.data.description, 'info');
							filesArray.push(command.data.toJSON());
						} else {
							cleanConsoleLogData(currentDir.name, ' ', 'error');
						}
					}
				}
			}
		}
	}
}