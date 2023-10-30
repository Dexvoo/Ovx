// Getting classes
const {
	Client,
	GatewayIntentBits,
	Collection,
	EmbedBuilder,
	Events,
	ChannelType,
} = require('discord.js');
const {
	cleanConsoleLog,
	cleanConsoleLogData,
} = require('./utils/ConsoleLogs.js');
const { sendEmbed } = require('./utils/Embeds.js');
require('dotenv').config();
const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	EmbedColour,
	FooterImage,
	FooterText,
} = process.env;
const path = require('node:path');
const { permissionCheck } = require('./utils/Checks.js');
const fsPromises = require('fs').promises;

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
		GatewayIntentBits.AutoModerationConfiguration, // Auto-moderation config update events
		GatewayIntentBits.AutoModerationExecution, // Auto-moderation execution events
	],
});

// Commands
client.commands = new Collection();
client.cooldowns = new Collection();

const init = async () => {
	let commandsDirectory = path.join(__dirname, 'commands');
	let eventsDirectory = path.join(__dirname, 'events');
	let modelsDirectory = path.join(__dirname, 'models');

	cleanConsoleLog('Loading Commands');
	await commandsCrawl(commandsDirectory, [], client);
	cleanConsoleLog('Loaded Commands');
	await eventsCrawl(eventsDirectory, [], client);
	cleanConsoleLog('Loaded Events');
	await modelsCrawl(modelsDirectory, [], client);
	cleanConsoleLog('Loaded Models');
};

cleanConsoleLog('Ovx Discord Bot');
cleanConsoleLogData('Created by: @Dexvo', ' ');
init();

client.on('interactionCreate', async (interaction) => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

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
	if (timestamps.has(interaction.user.id)) {
		const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

		if (now < expirationTime) {
			const expiredTimestamp = Math.round(expirationTime / 1000);
			const CooldownEmbed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription('• You are on cooldown! •')
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
	timestamps.set(interaction.user.id, now);
	setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			const Embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setDescription('• There was an error while executing this command! •')
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });
			await interaction.followUp({ embeds: [Embed] });
		} else {
			await sendEmbed(
				interaction,
				'There was an error while executing this command!'
			);
		}
	}
});

client.on(Events.MessageCreate, async (message) => {
	// Destructure the message
	const { author, guild, channel, content } = message;

	if (!content) return;

	console.log('content', content);
	const args = content.slice(1).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	if (content.startsWith('o')) {
		if (!author.id === '387341502134878218') return;

		if (!commandName) return;

		if (commandName === 'topservers') {
			// how to only display the first 10 entries

			const Members = client.guilds.cache
				.sort((a, b) => b.memberCount - a.memberCount)
				.map((guild) => {
					return `${guild.memberCount.toLocaleString()}`;
				});

			const IDs = client.guilds.cache
				.sort((a, b) => b.memberCount - a.memberCount)
				.map((guild) => {
					return `${guild.id}`;
				});

			const Names = client.guilds.cache
				.sort((a, b) => b.memberCount - a.memberCount)
				.map((guild) => {
					return `${guild.name}`;
				});

			const embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle(`Top 10 Ovx Servers (${client.guilds.cache.size})`)
				.addFields(
					{
						name: 'Names',
						value: `${Names.slice(0, 10).join('\n')}`,
						inline: true,
					},
					{
						name: 'IDs',
						value: `${IDs.slice(0, 10).join('\n')}`,
						inline: true,
					},
					{
						name: 'Members',
						value: `${Members.slice(0, 10).join('\n')}`,
						inline: true,
					}
				)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			return await message.channel.send({ embeds: [embed] });
		} else if (commandName === 'getinvite') {
			const targetGuild = client.guilds.cache.get(args[0]);

			if (!targetGuild) return await message.channel.send('Invalid guild id');

			// get first channel
			const targetChannel = targetGuild.channels.cache
				.filter((channel) => channel.type === ChannelType.GuildText)
				.first();

			// bot permissions
			const botPermissionsArry = ['ManageGuild'];
			const botPermissions = await permissionCheck(
				targetChannel,
				botPermissionsArry,
				client
			);

			if (!botPermissions[0])
				return await message.channel.send(
					`Bot Missing Permissions: \`${botPermissions[1]}\``
				);

			// fetch invite
			const invites = await targetGuild.invites.fetch().catch((err) => {
				console.log(err);
				return;
			});

			const invite = invites.first();

			if (!invite) return await message.channel.send('No invites found');

			return await message.channel.send(`https://discord.gg/${invite.code}`);
		}
	}
});

async function commandsCrawl(directory, filesArray) {
	const files = filesArray;
	const dirs = await fsPromises.readdir(directory, {
		withFileTypes: true,
	});

	//loop through all files/directories
	for (let i = 0; i < dirs.length; i++) {
		let currentDir = dirs[i];
		let newPath = path.join(directory, currentDir.name);

		if (currentDir.isDirectory()) {
			//if directory commandsCrawl again.
			await commandsCrawl(newPath, files);
		} else {
			//If it is a file append it to the array
			if (currentDir.name.endsWith('.js')) {
				files.push(newPath);

				const command = await require(newPath);

				if ('data' in command && 'execute' in command) {
					cleanConsoleLogData(
						command.data.name,
						command.data.description,
						'info'
					);
					client.commands.set(command.data.name, command);
				} else {
					cleanConsoleLogData(currentDir.name, ' ', 'error');
				}
			}
		}
	}
}

async function eventsCrawl(directory, filesArray) {
	const dirs = await fsPromises.readdir(directory, {
		withFileTypes: true,
	});

	//loop through all files/directories
	for (let i = 0; i < dirs.length; i++) {
		let currentDir = dirs[i];
		let newPath = path.join(directory, currentDir.name);

		if (currentDir.isDirectory()) {
			//if directory commandsCrawl again.
			await eventsCrawl(newPath, filesArray);
		} else {
			//If it is a file append it to the array
			if (currentDir.name.endsWith('.js')) {
				filesArray.push(newPath);

				const event = await require(newPath);

				if ('name' in event && 'execute' in event) {
					if (event.once) {
						client.once(event.name, (...args) =>
							event.execute(...args, client)
						);
					} else {
						client.on(event.name, (...args) => event.execute(...args, client));
					}
					cleanConsoleLogData(event.name, event.nickname, 'info');
				} else {
					cleanConsoleLogData(currentDir.name, ' ', 'error');
				}
			}
		}
	}
}

async function modelsCrawl(directory, filesArray) {
	const dirs = await fsPromises.readdir(directory, {
		withFileTypes: true,
	});

	//loop through all files/directories
	for (let i = 0; i < dirs.length; i++) {
		let currentDir = dirs[i];
		let newPath = path.join(directory, currentDir.name);

		if (currentDir.isDirectory()) {
			//if directory commandsCrawl again.
			await modelsCrawl(newPath, filesArray);
		} else {
			//If it is a file append it to the array
			if (currentDir.name.endsWith('.js')) {
				filesArray.push(newPath);

				const model = await require(newPath);

				if (model.length > 0) {
					cleanConsoleLogData(currentDir.name, ' ', 'info');
				} else {
					cleanConsoleLogData(currentDir.name, ' ', 'error');
				}
			}
		}
	}
}

// Client login
DeveloperMode === 'true'
	? client.login(PrivateToken)
	: client.login(PublicToken);
