// Getting Classes
require('dotenv').config();
const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	PrivateClientID,
	PublicClientID,
} = process.env;
const { Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fsPromises = require('fs').promises;
const path = require('node:path');

// const commands = [];

// const commandsPath = path.join(__dirname, 'commands');
// const commandFiles = fs
// 	.readdirSync(commandsPath)
// 	.filter((file) => file.endsWith('.js'));

// for (const file of commandFiles) {
// 	const commandFilePath = path.join(commandsPath, file);
// 	const command = require(commandFilePath);
// 	commands.push(command.data.toJSON());
// }

if (DeveloperMode == 'true') {
	var rest = new REST({ version: '10' }).setToken(PrivateToken);
	var ClientID = PrivateClientID;
} else {
	rest = new REST({ version: '10' }).setToken(PublicToken);
	ClientID = PublicClientID;
}

// // register commands for a guild

// rest
// 	.put(Routes.applicationGuildCommands(ClientID, '1115336808834805780'), {
// 		body: [],
// 	})
// 	.then(() => console.log('Successfully DELETED application commands. GUILD'))
// 	.catch(console.error);

// rest
// 	.put(Routes.applicationGuildCommands(ClientID, '1115336808834805780'), {
// 		body: commands,
// 	})
// 	.then(() =>
// 		console.log('Successfully REGISTERED application commands. GUILD')
// 	)
// 	.catch(console.error);

const init = async () => {
	let cmdFiles = [];
	let commandsDirectory = path.join(__dirname, 'commands');
	await commandsCrawl(commandsDirectory, cmdFiles);
	if (DeveloperMode == 'true') {
		rest
			.put(Routes.applicationGuildCommands(ClientID, '1115336808834805780'), {
				body: [],
			})
			.then(() =>
				console.log('Successfully DELETED application commands. GUILD')
			)
			.catch(console.error);

		rest
			.put(Routes.applicationGuildCommands(ClientID, '1115336808834805780'), {
				body: cmdFiles,
			})
			.then(() =>
				console.log('Successfully REGISTERED application commands. GUILD')
			)
			.catch(console.error);
		rest
			.put(Routes.applicationCommands(ClientID), { body: [] })
			.then(() =>
				console.log('Successfully DELETED application commands. GLOBAL')
			)
			.catch(console.error);
	} else {
		rest
			.put(Routes.applicationCommands(ClientID), { body: [] })
			.then(() =>
				console.log('Successfully DELETED application commands. GLOBAL')
			)
			.catch(console.error);

		rest
			.put(Routes.applicationCommands(ClientID), { body: cmdFiles })
			.then(() =>
				console.log('Successfully REGISTERED application commands. GLOBAL')
			)
			.catch(console.error);
		rest
			.put(Routes.applicationGuildCommands(ClientID, '1115336808834805780'), {
				body: [],
			})
			.then(() =>
				console.log('Successfully DELETED application commands. GUILD')
			)
			.catch(console.error);
	}
	console.log(
		'----------------------------------- Commands Refreshed -------------------------------'
	);
};

console.log(
	'------------------------------ Starting Command Refresh ------------------------------'
);
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
