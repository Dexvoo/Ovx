const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder, Interaction } = require('discord.js');
require('dotenv').config();
const { cleanConsoleLogData, cleanConsoleLog } = require('./utils/ConsoleLogs');
const { permissionCheck } = require('./utils/Checks');
const { PublicToken, DevToken, DeveloperMode } = process.env;
const path = require('node:path');
const fsPromises = require('fs').promises

// Creating a new client
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds, // Guild create/update/delete events (roles, channels, threads)
		GatewayIntentBits.GuildMembers, // Member add/update/remove events
		GatewayIntentBits.GuildModeration, // Ban add/remove and Guild audit log events
		GatewayIntentBits.GuildEmojisAndStickers, // Emoji and sticker create/update/delete events
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
client.cooldowns = new Collection();

const init = async () => {
	let commandsDirectory = path.join(__dirname, 'commands');
	let eventsDirectory = path.join(__dirname, 'events');
	let modelsDirectory = path.join(__dirname, 'models');

	cleanConsoleLog('Loading Commands');
	await crawlDirectory(commandsDirectory, 'commands');
	cleanConsoleLog('Loaded Commands');
	await crawlDirectory(eventsDirectory, 'events');
	cleanConsoleLog('Loaded Events');
	await crawlDirectory(modelsDirectory, 'models');
	cleanConsoleLog('Loaded Models');
};


cleanConsoleLog('Aqua Catch Discord Bot');
cleanConsoleLogData('Created by: @Dexvo', ' ');
init();


// Cooldowns


/**
     * @param {Interaction} interaction
     */
client.on('interactionCreate', async (interaction) => {

	const { guild, commandName, user  } = interaction;
	if (!interaction.isCommand()) return;

	const command = client.commands.get(commandName);

	if (!command) return;

	// Get cooldowns from client
	const { cooldowns } = client;

	// Check if the command has a cooldown
	if (!cooldowns.has(command.data.name)) {
		cooldowns.set(command.data.name, new Collection());
	}

	// Variables
	const now = Date.now();
	const timestamps = cooldowns.get(command.data.name);
	const defaultCooldown = 5;
	const cooldownAmount = (command.cooldown || defaultCooldown) * 1000;

	// Check if the user is on cooldown
	if (timestamps.has(user.id)) {
		const expirationTime = timestamps.get(user.id) + cooldownAmount;

		if (now < expirationTime) {
			const expiredTimestamp = Math.round(expirationTime / 1000);
			const CooldownEmbed = new EmbedBuilder()
				.setTitle('Command Cooldown')
				.setDescription('You are on cooldown!')
				.addFields(
					{
						name: 'Command',
						value: `\`/${command.data.name}\``,
						inline: true,
					},
					{
						name: 'Cooldown Ends',
						value: `<t:${expiredTimestamp}:R>`,
					}
				);
			const cooldownMessage = await interaction.reply({
				embeds: [CooldownEmbed],
				ephemeral: true,
			});
			return setTimeout(() => cooldownMessage.delete(), cooldownAmount - 2000);
		}
	}

	// Set the cooldown
	timestamps.set(user.id, now);
	setTimeout(() => timestamps.delete(user.id), cooldownAmount);


	// Check Bot Permissions

	if(guild) {
		if (command.botpermissions) {
			const [hasPermissions, missingPermissions] =  permissionCheck(interaction, command.botpermissions, client);
	
			if (!hasPermissions) {
				const Embed = new EmbedBuilder()
					.setColor('Red')
					.setDescription(`Bot Missing Permissions: \`${missingPermissions}\``);
				return await interaction.reply({ embeds: [Embed], ephemeral: true });
			}
		}
		// Check User Permissions
		if (command.userpermissions) {
			const [hasPermissions, missingPermissions] =  permissionCheck(interaction, command.userpermissions, interaction.member);
	
			if (!hasPermissions) {
				const Embed = new EmbedBuilder()
					.setColor('Red')
					.setDescription(`User Missing Permissions: \`${missingPermissions}\``);
				return await interaction.reply({ embeds: [Embed], ephemeral: true });
			}
		}
	}

	

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			const Embed = new EmbedBuilder()
				.setColor('Red')
				.setDescription('There was an error while executing this command!')
			await interaction.followUp({ embeds: [Embed] });
		} else {
			const Embed = new EmbedBuilder()
				.setColor('Red')
				.setDescription('There was an error while executing this command!')
			await interaction.reply({ embeds: [Embed] });
		
		}
	}
});










async function crawlDirectory(directory, crawlType) {
	const dirs = await fsPromises.readdir(directory, { withFileTypes: true });

	for (const dir of dirs) {
		const newPath = path.join(directory, dir.name);

		if (dir.isDirectory()) {
			await crawlDirectory(newPath, crawlType);
		} else {
			
			if (dir.name.endsWith('.js')) {
				if (crawlType === 'commands') {
					const command = await require(newPath);
					if ('data' in command && 'execute' in command) {
						cleanConsoleLogData(
							command.data.name,
							command.data.description,
							'info'
						);
						client.commands.set(command.data.name, command);
					} else {
						cleanConsoleLogData(dir.name, ' ', 'error');
					}
				}
				if (crawlType === 'events') {
					const event = await require(newPath);
					if ('name' in event && 'execute' in event) {
						if (event.once) {
							client.once(event.name, (...args) =>
								event.execute(...args, client)
							);
						} else {
							client.on(event.name, (...args) =>
								event.execute(...args, client)
							);
						}
						cleanConsoleLogData(event.name, event.nickname, 'info');
					} else {
						cleanConsoleLogData(dir.name, ' ', 'error');
					}
				}
				if (crawlType === 'models') {
					const model = await require(newPath);

					if (model.length > 0) {
						cleanConsoleLogData(dir.name, ' ', 'info');
					} else {

						for (const key in model) {
							if (model.hasOwnProperty(key)) {
								const element = model[key];
								cleanConsoleLogData('Models', key, 'info');
							}
						}
					}
				}
				
			}
		}
	}
}

// Client login
if(DeveloperMode === 'true') {
	client.login(DevToken);
} else {
	client.login(PublicToken);
}