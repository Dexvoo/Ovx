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
					const rawLeaderboard = await fetchLeaderboard(guild.id, 25);

					// Checking if the leaderboard is empty
					if (rawLeaderboard.length < 1) {
						await sendEmbed(
							interaction,
							'0 users have earned xp in this guild, please send messages to earn xp'
						);
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
							`\` | L: \`${
								e.level
							}\` | XP: \`${e.xp.toLocaleString()}\` | M: \`${e.messages.toLocaleString()}\` | V: \`${e.voice.toLocaleString()}\``
					);

					// Embed
					const LeaderboardEmbed = new EmbedBuilder()
						.setTitle(`${guild.name} | Level Leaderboard`)
						.setThumbnail(guild.iconURL())
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

async function computeLeaderboard(client, leaderboard, fetchUsers = false) {
	if (!client) throw new TypeError('A client was not provided.');
	if (!leaderboard) throw new TypeError('A leaderboard id was not provided.');

	if (leaderboard.length < 1) return [];

	const computedArray = [];
	var totalGuildLevels = 0;

	if (fetchUsers) {
		for (const key of leaderboard) {
			const user = await client.users.fetch(key.userId);
			totalGuildLevels = totalGuildLevels + key.level;

			computedArray.push({
				guildId: key.guildId,
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
		}
	} else {
		totalGuildLevels = totalGuildLevels + key.level;
		leaderboard.map((key) =>
			computedArray.push({
				guildID: key.guildID,
				userID: key.userID,
				xp: key.xp,
				level: key.level,
				position:
					leaderboard.findIndex(
						(i) => i.guildID === key.guildID && i.userID === key.userID
					) + 1,
				username: client.users.cache.get(key.userID)
					? client.users.cache.get(key.userID).username
					: 'Unknown',
			})
		);
	}

	return [computedArray, totalGuildLevels];
}
