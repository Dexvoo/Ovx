const { GatewayIntentBits, Collection } = require('discord.js');
const OvxClient = require('./structures/OvxClient')
const path = require('node:path');
const fsPromises = require('node:fs').promises;
require('dotenv').config();
const { DeveloperMode, PublicToken, DevToken } = process.env;


// Creating Client
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
    ]
});

client.commands = new Collection();

// Initialise bot with commands/models/events
const initialise = async () => {
    
    const directories = ['commands', 'models', 'events'];

    for (let i = 0; i < directories.length; i++) {
        client.utils.Log(`Loading ${directories[i]}`);
		const currentDirectory = path.join(__dirname, directories[i]);
		await crawlDirectory(currentDirectory, directories[i]);
    }

	client.utils.Log('Completed Initialisation');
};

initialise();


async function crawlDirectory(currentDirectory, type) {
	const allDirectories = await fsPromises.readdir(currentDirectory, { withFileTypes: true });

	for(const directory of allDirectories) {
		const newPath = path.join(currentDirectory, directory.name);

		if(directory.isDirectory()) await crawlDirectory(newPath, type);
		
		if(!directory.name.endsWith('.js')) continue;

		switch (type) {
			case 'commands':
				const command = await require(newPath);
				if('data' in command && 'execute' in command) {
					client.utils.LogData(command.data.name, command.data.description, 'info');
					client.commands.set(command.data.name, command);
				} else {
					client.utils.LogData(directory.name, ' ', 'error');
				};
				break;
			case 'models':
				const model = await require(newPath);
				if(model.length > 0 ) {
					client.utils.LogData('Models', model[0], 'error');
				} else {
					for (const key in model) {
						if (model.hasOwnProperty(key)) {
							client.utils.LogData('Models', key, 'info');
						}
					}
				};
				break
			case 'events':
				const event = await require(newPath);
				if('name' in event && 'execute' in event) {
					if(event.once) {
						client.once(event.name, (...args) => event.execute(...args));
					} else {
						client.on(event.name, (...args) => event.execute(...args));
					}
					client.utils.LogData(event.name, event.nickname, 'info');
				} else {
					client.utils.LogData(directory.name, ' ', 'error');
				}
				break
		
			default:
				break;
		}
	}
};


client.login(DeveloperMode === 'true' ? DevToken : PublicToken);