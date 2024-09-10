require('dotenv').config();
const { PublicToken, DevToken, PublicClientID, DevClientID, DeveloperMode } = process.env;
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
	await commandsCrawl(commandsDirectory, commandFiles);

	rest.put(Routes.applicationCommands(ClientID), { body: [] })
	.then(() =>
		cleanConsoleLogData('Commands', 'Deleted application commands', 'success')
	).catch(console.error);


	// delete guild commands
	rest.put(Routes.applicationGuildCommands(ClientID, '1115336808834805780'), { body: [] }).then(() =>
		cleanConsoleLogData('Commands', 'Deleted guild commands', 'success')
	).catch(console.error);

	rest.put(Routes.applicationCommands(ClientID), { body: commandFiles })
	.then(( ) => {
		cleanConsoleLogData('Commands', 'Registered application commands', 'success');
		cleanConsoleLog('Finished Command Refresh');
	}).catch(console.error);
};
init();



















async function commandsCrawl(directory, filesArray) {
	const dirs = await fsPromises.readdir(directory, {
		withFileTypes: true,
	});

	//loop through all files/directories
	for (let i = 0; i < dirs.length; i++) {
		let currentDir = dirs[i];
		let newPath = path.join(directory, currentDir.name);

		if (currentDir.isDirectory()) {
			//if directory commandsCrawl again.
			await commandsCrawl(newPath, filesArray);
		} else {
			// if (newPath.includes('Developer')) continue;

			//if it is a file append it to the array
			if (currentDir.name.endsWith('.js')) {
				const command = await require(newPath);

				if ('data' in command && 'execute' in command) {
					const string =
						`${command.data.name} \u001b[0m| ${command.data.description}`.padEnd(
							86,
							' '
						);
					filesArray.push(command.data.toJSON());
					console.log(`| \u001b[1;32m/${string}|`);
				} else {
					const string = `${currentDir.name}`.padEnd(73, ' ');
					console.log(`| \u001b[1;31m[Error] | ${string}\u001b[0m|`);
				}
			}
		}
	}
}