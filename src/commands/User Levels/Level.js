const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	parseEmoji,
	PermissionsBitField,
} = require('discord.js');
const { sendEmbed, sendErrorEmbed } = require('../../utils/Embeds.js');
const { guildCheck, permissionCheck } = require('../../utils/Checks.js');
const { calculateLevel } = require('../../utils/XP.js');
const { sleep } = require('../../utils/ConsoleLogs.js');
const Levels = require('../../models/GuildLevels.js');
const {
	DeveloperMode,
	PrivateToken,
	PublicToken,
	EmbedColour,
	FooterImage,
	FooterText,
} = process.env;
require('dotenv').config();

module.exports = {
	cooldown: 5,
	catagory: 'Levels',
	data: new SlashCommandBuilder()
		.setName('level')
		.setDescription('Get a users level and XP or even a leaderbaord.')
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('rank')
				.setDescription('Shows your current level and XP in the guild.')
				.addUserOption((option) =>
					option
						.setName('user')
						.setDescription('The user you would like to look up.')
						.setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('leaderboard')
				.setDescription(
					'Displays the most active users in a leaderboard (Guild Only).'
				)
				.addStringOption((option) =>
					option
						.setName('type')
						.setDescription('The type of leaderboard to show.')
						.setRequired(true)
						.addChoices(
							{
								name: 'Levels',
								value: 'levels',
							},
							{
								name: 'Messages',
								value: 'messages',
							},
							{
								name: 'Voice',
								value: 'voice',
							}
						)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('admin')
				.setDescription('Admin commands for levels.')
				.addStringOption((option) =>
					option
						.setName('type')
						.setDescription('The type of change to make.')
						.setRequired(true)
						.addChoices(
							{
								name: 'Level',
								value: 'level',
							},
							{
								name: 'XP',
								value: 'xp',
							},
							{
								name: 'Reset',
								value: 'reset',
							}
						)
				)
				.addIntegerOption((option) =>
					option
						.setName('levelxp')

						.setDescription('The level/XP to change to.')
						.setMinValue(0)
						.setRequired(true)
				)
				.addUserOption((option) =>
					option
						.setName('user')
						.setDescription('The user to change.')
						.setRequired(true)
				)
		),
	/**
	 * @param {CommandInteraction} interaction
	 * @returns
	 */

	async execute(interaction) {
		try {
			const { guild, member, options, user, client, channel } = interaction;

			// Placeholder embed
			await sendEmbed(interaction, 'Getting level information');
			await sleep(2000);

			// Checking if the user is in a guild
			if (!(await guildCheck(guild))) return;

			switch (options.getSubcommand()) {
				case 'rank':
					// Variables
					const target = options.getUser('user') || user;
					const query = { guildId: guild.id, userId: target.id };

					// Checking if the user is in the database
					const userExists = await Levels.exists(query);

					if (!userExists) {
						await sendEmbed(
							interaction,
							`${target.username} has not sent any messages in this guild, please send messages to earn xp`
						);
						return;
					}

					const userData = await Levels.findOne(query);

					// Embed
					const LevelEmbed = new EmbedBuilder()
						.setColor(EmbedColour)
						.setTitle(`• Levels/Rank •`)
						.setDescription(
							[
								`- User: ${target}`,
								`- Level: **${userData.level}**`,
								`- XP: **${userData.xp}**`,
								`- Messages: **${userData.messages}**`,
								`- Voice Time: **${userData.voice}** minutes`,
							].join('\n')
						)
						.setTimestamp()
						.setFooter({ text: FooterText, iconURL: FooterImage });

					await interaction.editReply({ embeds: [LevelEmbed] });
					break;

				case 'leaderboard':
					// Variables

					const typeLB = options.getString('type')
						
					
					var rawLeaderboard = await fetchLeaderboard(guild.id, 25, typeLB);
					var totalGuildUsers = rawLeaderboard.length;

					// add the total guild levels
					var totalGuildLevels = 0;
					var totalGuildVoiceMinutes = 0;
					var totalGuildMessages = 0;
					rawLeaderboard.forEach((key) => {
						totalGuildLevels = totalGuildLevels + key.level;
						totalGuildVoiceMinutes = totalGuildVoiceMinutes + key.voice;
						totalGuildMessages = totalGuildMessages + key.messages;
					});

					console.log('total guild levels: ', totalGuildLevels);
					console.log('total guild users: ', totalGuildUsers);
					console.log('total guild voice minutes: ', totalGuildVoiceMinutes);
					console.log('total guild messages: ', totalGuildMessages);

					// Checking if the leaderboard is empty
					if (rawLeaderboard.length < 1) {
						await sendEmbed(
							interaction,
							'0 users have earned xp in this guild, please send messages to earn xp'
						);
						return;
					}

					rawLeaderboard = rawLeaderboard.slice(0, 15);

					const leaderboard = await computeLeaderboard(
						client,
						rawLeaderboard,
						true
					);


					switch (typeLB) {
						case 'messages':
							var lb = leaderboard.map(
								(e) =>
									`\`` +
									`${e.position}`.padStart(2, ' ') +
									`\`. \`@` +
									`${e.username}`.padEnd(18, ' ') +
									`\` | M: \`${
										e.messages.toLocaleString()
									}\``
							);
							break
						case 'voice':
							var lb = leaderboard.map(
								(e) =>
									`\`` +
									`${e.position}`.padStart(2, ' ') +
									`\`. \`@` +
									`${e.username}`.padEnd(18, ' ') +
									`\` | V: \`${
										e.voice.toLocaleString()
									}\``
							);

							break
						case 'levels':
							var lb = leaderboard.map(
								(e) =>
									`\`` +
									`${e.position}`.padStart(2, ' ') +
									`\`. \`@` +
									`${e.username}`.padEnd(18, ' ') +
									`\` | L: \`${
										e.level
									}\` | XP: \`${e.xp.toLocaleString()}\` | M: \`${e.messages.toLocaleString()}\` | V: \`${e.voice.toLocaleString()}\``
							);
							break
						default:
							await sendEmbed(
								interaction,
								'Please provide a valid type to show the leaderboard for.'
							);
							return;
					}

					

					// Embed
					const LeaderboardEmbed = new EmbedBuilder()
					
						.setTitle(`${guild.name} | ${typeLB.charAt(0).toUpperCase() + typeLB.slice(1)} Leaderboard`)
						.setThumbnail(guild.iconURL())
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

					const pageSize = 5;
					const maxPages = 3;
					let currentPage = 1; // Initialize the current page to 1

					for (
						let i = 0;
						i < lb.length && currentPage <= maxPages;
						i += pageSize
					) {
						const page = lb.slice(i, i + pageSize);
						const name = `Top ${i + 1}-${Math.min(i + pageSize, lb.length)}`;
						const value = page.join('\n');
						LeaderboardEmbed.addFields({ name, value, inline: false });

						currentPage++; // Increment the current page number
					}
					await interaction.editReply({ embeds: [LeaderboardEmbed] });

					break;

				case 'admin':
					// Variables

					// User permissions
					const userPermissionsArry = ['Administrator'];
					const userPermissions = await permissionCheck(
						interaction,
						userPermissionsArry,
						client
					);

					if (!userPermissions[0])
						return await sendEmbed(
							interaction,
							`User Missing Permissions: \`${userPermissions[1]}\``
						);

					const type = options.getString('type');
					const targetUser = options.getUser('user') || user;
					const query2 = { guildId: guild.id, userId: targetUser.id };

					switch (type) {
						case 'level':
							const level = options.getInteger('levelxp');
							const userDataLevel = await Levels.findOne(query2);

							if (!level) {
								await sendEmbed(
									interaction,
									'Please provide a valid level to change to'
								);
								return;
							}

							// Setting user data
							userDataLevel.level = level;
							userDataLevel.xp = 0;

							// Saving user data
							await userDataLevel.save().catch((error) => console.log(error));

							// Embed
							const LevelEmbed2 = new EmbedBuilder()
								.setColor(EmbedColour)
								.setTitle(`• Levels/Rank •`)
								.setDescription(
									[
										`- User: ${targetUser}`,
										`- Level: **${userDataLevel.level}**`,
										`- XP: **${userDataLevel.xp}**`,
									].join('\n')
								)
								.setTimestamp()
								.setFooter({ text: FooterText, iconURL: FooterImage });

							await interaction.editReply({ embeds: [LevelEmbed2] });

							break;
						case 'xp':
							const xp = options.getInteger('levelxp');
							const userDataLevel2 = await Levels.findOne(query2);

							if (!xp) {
								await sendEmbed(
									interaction,
									'Please provide a valid level to change to'
								);
								return;
							}

							if (xp >= calculateLevel(userDataLevel2.level)) {
								await sendEmbed(
									interaction,
									`Please provide a valid xp to change to, it needs to be below \`${calculateLevel(
										userDataLevel2.level
									).toLocaleString()}\``
								);
								return;
							}

							// Setting user data
							userDataLevel2.xp = xp;

							// Saving user data
							await userDataLevel2.save().catch((error) => console.log(error));

							// Embed
							const LevelEmbed3 = new EmbedBuilder()
								.setColor(EmbedColour)
								.setTitle(`• Levels/Rank •`)
								.setDescription(
									[
										`- User: ${targetUser}`,
										`- Level: **${userDataLevel2.level}**`,
										`- XP: **${userDataLevel2.xp}**`,
									].join('\n')
								)
								.setTimestamp()
								.setFooter({ text: FooterText, iconURL: FooterImage });

							await interaction.editReply({ embeds: [LevelEmbed3] });

							break;
						case 'reset':
							const userDataLevel3 = await Levels.findOne(query2);

							// Setting user data
							userDataLevel3.xp = 0;
							userDataLevel3.level = 0;
							userDataLevel3.messages = 0;
							userDataLevel3.voice = 0;

							// Bot permissions
							const botPermissionsArry = ['ViewChannel'];
							const botPermissions = await permissionCheck(
								interaction,
								botPermissionsArry,
								client
							);

							if (!botPermissions[0])
								return await sendEmbed(
									interaction,
									`Bot Missing Permissions: \`${botPermissions[1]}\` | Cannot get response from user`
								);

							await sendEmbed(
								interaction,
								`Are you sure you want to reset @${targetUser.username}'s level and xp? (yes/no)`
							);

							// message collector for confirmation
							const filter = (m) => m.author.id === interaction.user.id;
							const collector = channel.createMessageCollector({
								filter,
								time: 15000,
								max: 1,
							});

							// send message on timeout
							collector.on('end', async (collected) => {
								if (collected.size < 1) {
									await sendEmbed(
										interaction,
										'You did not respond in time, please try again, you have 15 seconds to respond'
									);
									return;
								}
							});

							collector.on('collect', async (m) => {
								if (m.content.toLowerCase() == 'yes') {
									await sendEmbed(
										interaction,
										`Resetting @${targetUser.username}'s data`
									);
									await sleep(2000);
									// Saving user data
									await userDataLevel3
										.save()
										.catch((error) => console.log(error));

									// Embed
									const LevelEmbed3 = new EmbedBuilder()
										.setColor(EmbedColour)
										.setTitle(`• Levels/Rank •`)
										.setDescription(
											[
												`- User: ${targetUser}`,
												`- Level: **${userDataLevel3.level}**`,
												`- XP: **${userDataLevel3.xp}**`,
											].join('\n')
										)
										.setTimestamp()
										.setFooter({ text: FooterText, iconURL: FooterImage });

									await interaction.editReply({ embeds: [LevelEmbed3] });
								} else {
									await sendEmbed(interaction, 'Cancelling reset');
									return;
								}
							});
							break;
					}

					break;
			}
		} catch (error) {
			console.error(error);
			await sendErrorEmbed(
				interaction,
				`An error occured while executing this command: \`${error.message}\``
			);
		}
	},
};

// Functions
async function fetchLeaderboard(guildId, limit, type) {
	if (!guildId) throw new TypeError('A guild id was not provided.');
	if (!limit) throw new TypeError('A limit was not provided.');
	if (!type) throw new TypeError('A type was not provided.');



	if ( type === 'messages') {
		var users = await Levels.find({ guildId: guildId }).sort({ messages: -1 }).limit(limit).exec();
	} else if (type === 'voice') {
		var users = await Levels.find({ guildId: guildId }).sort({ voice: -1 }).limit(limit).exec();
	} else if (type === 'levels') {
		var users = await Levels.find({ guildId: guildId }).sort([ ['level', 'descending'], ['xp', 'descending'] ]).exec();
	}


	// Levels

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

	console.log('computing leaderboard');

	for (const key of leaderboard) {
		var user = client.users.cache.get(key.userId);

		if (!user) {
			user = await client.users.fetch(key.userId);
			console.log(`Forced fetched user @${user.username}`);
		} else {
			console.log(`Cached user @${user.username}`);
		}

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
