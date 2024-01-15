// Getting classes
const {
	Client,
	GatewayIntentBits,
	Collection,
	EmbedBuilder,
	Events,
	ChannelType,
	Message,
} = require('discord.js');
const {
	cleanConsoleLog,
	cleanConsoleLogData,
	sleep,
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
const Levels = require('./models/GuildLevels.js');

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

/**
 * @param {Message} message
 */

client.on(Events.MessageCreate, async (message) => {
	// Destructure the message
	const { author, guild, channel, content } = message;

	if (!content) return;

	const args = content.slice(1).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	if (content.toLowerCase().startsWith('o')) {
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

			// get total members
			const totalMembers = client.guilds.cache.reduce(
				(a, g) => a + g.memberCount,
				0
			);
			const embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle(
					`Top 10 Ovx Servers (Guilds: ${client.guilds.cache.size} Members: ${totalMembers}) `
				)
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
		} else if (commandName === 'topusers') {
			const rawLeaderboard = await fetchTotalLeaderboard(15);

			// Checking if the leaderboard is empty
			if (rawLeaderboard.length < 1) {
				await message.channel.send('No users have earned xp in this guild');
				return;
			}

			const leaderboard = await computeLeaderboard(
				client,
				rawLeaderboard,
				true
			);
			const totalGuildLevels2 = leaderboard[1];
			const lb = leaderboard[0].map(
				(e) =>
					`\`` +
					`${e.position}`.padStart(2, ' ') +
					`\`. \`@` +
					`${e.username}`.padEnd(18, ' ') +
					`\` | Guild: \`${e.guildName}\` |\n\nLevel: \`${e.level} | XP: \`${e.xp}\` | M: \`${e.messages}\` | V: \`${e.voice}\``
			);

			// Embed
			const LeaderboardEmbed = new EmbedBuilder()
				.setTitle(`@${client.user.username} | Level Leaderboard`)
				.setThumbnail(client.user.avatarURL())
				.addFields(
					{
						name: 'Total Guild Levels',
						value: totalGuildLevels2.toLocaleString(),
						inline: true,
					},
					{
						name: 'Total Guild Users',
						value: rawLeaderboard.length.toLocaleString(),
						inline: true,
					}
				)
				.setTimestamp()
				.setColor(EmbedColour)
				.setFooter({ text: FooterText, iconURL: FooterImage });

			const pageSize = 3;
			const maxPages = 5;
			let currentPage = 1; // Initialize the current page to 1

			for (let i = 0; i < lb.length && currentPage <= maxPages; i += pageSize) {
				const page = lb.slice(i, i + pageSize);
				const name = `Top ${i + 1}-${Math.min(i + pageSize, lb.length)}`;
				const value = page.join('\n');
				LeaderboardEmbed.addFields({ name, value, inline: false });

				currentPage++; // Increment the current page number
			}

			return await message.channel.send({ embeds: [LeaderboardEmbed] });
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
		} else if (commandName === 'getleaderboard') {
			const targetGuild = client.guilds.cache.get(args[0]);

			if (!targetGuild) return await message.channel.send('Invalid guild id');

			var rawLeaderboard = await fetchLeaderboard(targetGuild.id, 15);
			var totalGuildUsers = rawLeaderboard.length;

			// add the total guild levels
			var totalGuildLevels = 0;
			rawLeaderboard.forEach((key) => {
				totalGuildLevels = totalGuildLevels + key.level;
			});

			// Checking if the leaderboard is empty
			if (rawLeaderboard.length < 1) {
				await message.channel.send('No users have earned xp in this guild');
				return;
			}

			rawLeaderboard = rawLeaderboard.slice(0, 15);

			const leaderboard = await computeLeaderboard(
				client,
				rawLeaderboard,
				true
			);
			const lb = leaderboard.map(
				(e) =>
					`\`` +
					`${e.position}`.padStart(2, ' ') +
					`\`. \`@` +
					`${e.username}`.padEnd(18, ' ') +
					`\` | L: \`${
						e.level
					}\` | XP: \`${e.xp.toLocaleString()}\` | M: \`${e.messages.toLocaleString()}\` | V: \`${e.voice.toLocaleString()}\``
			);

			// Embed
			const LeaderboardEmbed = new EmbedBuilder()
				.setTitle(`${targetGuild.name} | Level Leaderboard`)
				.setThumbnail(targetGuild.iconURL())
				.addFields(
					{
						name: 'Total Guild Levels',
						value: totalGuildLevels.toLocaleString(),
						inline: true,
					},
					{
						name: 'Total Guild Users',
						value: totalGuildUsers.toLocaleString(),
						inline: true,
					}
				)
				.setTimestamp()
				.setColor(EmbedColour)
				.setFooter({ text: FooterText, iconURL: FooterImage });

			const pageSize = 3;
			const maxPages = 5;
			let currentPage = 1; // Initialize the current page to 1

			for (let i = 0; i < lb.length && currentPage <= maxPages; i += pageSize) {
				const page = lb.slice(i, i + pageSize);
				const name = `Top ${i + 1}-${Math.min(i + pageSize, lb.length)}`;
				const value = page.join('\n');
				LeaderboardEmbed.addFields({ name, value, inline: false });

				currentPage++; // Increment the current page number
			}

			return await message.channel.send({ embeds: [LeaderboardEmbed] });
		} else if (commandName === 'getguild') {
			const targetGuild = client.guilds.cache.get(args[0]);

			if (!targetGuild) return await message.channel.send('Invalid guild id');

			//
			const embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle(`Guild Info`)
				.addFields(
					{
						name: 'Name',
						value: `${targetGuild.name}`,
						inline: true,
					},
					{
						name: 'ID',
						value: `${targetGuild.id}`,
						inline: true,
					},
					{
						name: 'Members',
						value: `${targetGuild.memberCount}`,
					},
					{
						name: 'Owner',
						value: `${targetGuild.ownerId}`,
						inline: true,
					},
					{
						name: 'Created At',
						value: `${targetGuild.createdAt}`,
					},
					{
						name: 'Boosts',
						value: `${targetGuild.premiumSubscriptionCount}`,
						inline: true,
					},
					{
						name: 'Boost Level',
						value: `${targetGuild.premiumTier}`,
						inline: true,
					},
					{
						name: 'Region',
						value: `${targetGuild.region}`,
					}
				)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			return await message.channel.send({ embeds: [embed] });
		} else if (commandName === 'removeusers') {
			const targetRole = guild.roles.cache.get(args[0]);

			if (!targetRole) return await message.channel.send('Invalid role id');

			// remove everyone from the role without getting ratelimited  (max 1000 per 10 mins)
			const members = await guild.members.fetch();
			const membersWithRole = members.filter((m) =>
				m.roles.cache.has(targetRole.id)
			);

			// loop through the members and remove the role without an array
			membersWithRole.forEach(async (member) => {
				console.log(`Removing role from @${member.user.username}`);
				await sleep(1000);
				await member.roles.remove(targetRole).catch((err) => {
					console.log(err);
				});
			});

			// send a message saying complete
			const embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle(`Removed role from ${membersWithRole.size} members`)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			console.log(`DONE`);

			return await message.channel.send({ embeds: [embed] });
		}
	}
});

client.on(Events.MessageCreate, async (message) => {
	// Destructure the message
	const { author, guild, channel, content, member } = message;

	if (!guild) return;

	if (guild.id !== '939516208858931250') return;

	if (!content) return;

	const args = content.slice(1).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	if (content.startsWith('o')) {
		if (!commandName) return;

		if (commandName === 'claim') {
			// check that the user joined the guild before the claim date
			const joinDate = member.joinedAt.getTime();
			// claim date is 28th of november 2023
			const claimDate = new Date('2023-11-28T00:00:00.000Z').getTime();

			console.log('joinDate', joinDate);
			console.log('claimDate', claimDate);

			if (joinDate > claimDate)
				return await message.channel.send(
					'You are not eligible to claim this reward'
				);

			// check if the user has already claimed the reward (got the role)
			const role =
				guild.roles.cache.get('1178944056550772776') ||
				(await guild.roles.fetch('1178944056550772776').catch((err) => {}));

			if (role) {
				if (member.roles.cache.has(role.id))
					return await message.channel.send(
						'You have already claimed this reward'
					);
			}

			// give the user the role
			await member.roles.add(role);

			// send a message to the user
			const embed = new EmbedBuilder()
				.setColor(EmbedColour)
				.setTitle(`Claimed Reward`)
				.setDescription(`You have claimed the role ${role}`)
				.setTimestamp()
				.setFooter({ text: FooterText, iconURL: FooterImage });

			return await message.channel.send({ embeds: [embed] });
		}
	}
});

// Functions

async function fetchTotalLeaderboard(limit) {
	if (!limit) throw new TypeError('A limit was not provided.');

	var users = await Levels.find({})
		.sort([
			['level', 'descending'],
			['xp', 'descending'],
		])
		.exec();

	if (limit) {
		users = users.slice(0, limit);
	}

	return users;
}

async function fetchLeaderboard(guildId, limit) {
	if (!guildId) throw new TypeError('A guild id was not provided.');
	if (!limit) throw new TypeError('A limit was not provided.');

	var users = await Levels.find({ guildId: guildId })
		.sort([
			['level', 'descending'],
			['xp', 'descending'],
		])
		.exec();

	return users;
}

/**
 * @param {Client} client
 */

async function computeLeaderboard(client, leaderboard) {
	if (!client) throw new TypeError('A client was not provided.');
	if (!leaderboard) throw new TypeError('A leaderboard id was not provided.');

	if (leaderboard.length < 1) return [];

	const computedArray = [];
	var totalGuildLevels = 0;

	console.log('computing leaderboard');

	for (const key of leaderboard) {
		var user = client.users.cache.get(key.userId);

		if (!user) {
			user = await client.users.fetch(key.userId);
			console.log(`Forced fetched user @${user.username}`);
		} else {
			console.log(`Cached user @${user.username}`);
		}
		totalGuildLevels = totalGuildLevels + key.level;

		const guild = client.guilds.cache.get(key.guildId);
		const guildName = guild ? guild.name : 'Unknown';

		computedArray.push({
			guildName: guildName,
			userId: key.userId,
			xp: key.xp,
			level: key.level,
			messages: key.messages,
			voice: key.voice,
			position:
				leaderboard.findIndex(
					(i) => i.guildId === key.guildId && i.userId === key.userId
				) + 1,
			username: user ? user.username : 'Unknown',
		});
		// 	}
		// } else {
		// console.log('fetchUsers is false');
		// totalGuildLevels = totalGuildLevels + key.level;
		// leaderboard.map((key) =>
		// 	computedArray.push({
		// 		guildID: key.guildID,
		// 		userID: key.userID,
		// 		xp: key.xp,
		// 		level: key.level,
		// 		messages: key.messages,
		// 		voice: key.voice,
		// 		position:
		// 			leaderboard.findIndex(
		// 				(i) => i.guildID === key.guildID && i.userID === key.userID
		// 			) + 1,
		// 		username: client.users.cache.get(key.userID)
		// 			? client.users.cache.get(key.userID).username
		// 			: 'Unknown',
		// 	})
		// );
	}

	console.log('returning array');

	return computedArray;
}

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
